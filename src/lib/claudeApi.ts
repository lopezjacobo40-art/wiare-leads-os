import type { Lead, AnalisisBrechas } from './supabaseClient'
import { guardedCall } from './tokenGuard'
import { SECTORES, RESISTENCIAS, type Resistencia } from './simuladorData'
import { WIARE_CONTEXTO } from './wiareContexto'
import { getNichoBrechas } from './brechasConfig'
import { callGemini } from './geminiApi'

const API_URL = 'https://api.anthropic.com/v1/messages'
const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/* Mensaje de una conversación multi-turno. */
export type ChatMsg = { role: 'user' | 'assistant'; content: string }

/* Variante multi-turno: acepta el historial completo y un system prompt opcional.
   Base del Simulador de ventas y el Consultor IA. */
async function callClaudeChat(
  model: string,
  maxTokens: number,
  messages: ChatMsg[],
  system?: string
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content[0].text
}

/* ─────────────────────────────────────────────
   ANÁLISIS DE BRECHAS
   Sustituye al antiguo scoreLead. Claude analiza el negocio con los
   datos ya extraídos de Apify y devuelve: encaje (score), informe,
   3 brechas, 3 puntos listos para pegar en la plantilla de email, y
   un ahorro estimado. Haiku — rápido y barato, apto para bulk.
   ───────────────────────────────────────────── */

export interface ResultadoBrechas {
  score: number
  resumen: string
  brechas: string[]
  puntos_email: string[]
  ahorro_estimado: string
  volumen: 'bajo' | 'medio' | 'alto' | 'muy_alto'
  mrr: number
  recomendacion: 'contactar' | 'dudoso' | 'descartar'
  encaje: string
}

export async function analizarBrechas(lead: Lead): Promise<ResultadoBrechas> {
  const nicho = getNichoBrechas(lead.sector)
  const horario = Array.isArray(lead.horario)
    ? lead.horario.join('; ')
    : lead.horario
      ? JSON.stringify(lead.horario)
      : 'Desconocido'

  const prompt = `Eres analista CRÍTICO de WIARE. WIARE instala un sistema de atención 24/7
para negocios locales en España que pierden llamadas y consultas fuera de horario.

REGLA FUNDAMENTAL: La mayoría de negocios NO son clientes ideales. Sé brutalmente honesto.
Si el encaje es débil, puntuación BAJA (1-4) y recomendación DESCARTAR. No infles el score.

DATOS DEL NEGOCIO (Google Maps):
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Ciudad: ${lead.ciudad ?? 'España'}
Valoración: ${lead.valoracion ?? 'N/D'}/5 — Reseñas: ${lead.num_resenas ?? 0}
Tiene web: ${lead.web ? 'Sí' : 'No'}
Horario: ${horario}
Descripción: ${lead.descripcion ?? 'Sin descripción'}

NICHO "${nicho.label}":
Problema core: ${nicho.problema_core}
Palancas WIARE:
${nicho.palancas.map((p) => `- ${p}`).join('\n')}

CUÁNDO PUNTUAR BAJO (1-4) y DESCARTAR:
- Cadena o franquicia (ya tiene centralita/recepcionista)
- Sector con atención online ya resuelta (e-commerce, SaaS, apps)
- Horario 24/7 ya cubierto o sin citas
- Pocas reseñas + sin web = negocio pequeño sin presupuesto
- El problema que WIARE resuelve no aplica a este sector

CUÁNDO PUNTUAR ALTO (7-10) y CONTACTAR:
- Clínica/peluquería/restaurante con horario limitado y muchas reseñas
- Sin web o web básica + volumen visible de clientes
- Sector donde la cita previa o reserva es crítica
- Probable pérdida real de clientes fuera de horario

ESCALA HONESTA:
1-3: descartar, no merece email
4-5: dudoso, solo si no hay mejores leads
6-7: buen encaje, contactar
8-10: reservar para encajes MUY evidentes (no más del 15% de negocios)

LENGUAJE: NUNCA "IA", "bot", "algoritmo". SÍ "atención", "recepción", "clientes perdidos".
Los puntos_email son frases persuasivas concretas, listas para pegar en plantilla. 1 frase cada una.

Responde SOLO en JSON sin markdown:
{
  "score": número 1-10,
  "recomendacion": "contactar|dudoso|descartar",
  "encaje": "1 frase explicando POR QUÉ encaja o no encaja con WIARE",
  "resumen": "informe 3-4 frases sobre brechas de atención de ESTE negocio concreto",
  "brechas": ["brecha 1 específica de este negocio", "brecha 2", "brecha 3"],
  "puntos_email": ["punto 1 listo para email", "punto 2", "punto 3"],
  "ahorro_estimado": "estimación orientativa, p.ej. ~800€/mes en citas perdidas",
  "volumen": "bajo|medio|alto|muy_alto",
  "mrr": número entre 90 y 390
}`

  const text = await guardedCall('score', () => callGemini(prompt))
  const json = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(json)
  const recomendacion = ['contactar', 'dudoso', 'descartar'].includes(parsed.recomendacion)
    ? parsed.recomendacion as ResultadoBrechas['recomendacion']
    : 'dudoso'
  return {
    score: Math.max(0, Math.min(10, Number(parsed.score))),
    resumen: String(parsed.resumen ?? ''),
    brechas: Array.isArray(parsed.brechas) ? parsed.brechas.map(String).slice(0, 3) : [],
    puntos_email: Array.isArray(parsed.puntos_email) ? parsed.puntos_email.map(String).slice(0, 3) : [],
    ahorro_estimado: String(parsed.ahorro_estimado ?? ''),
    volumen: parsed.volumen ?? 'medio',
    mrr: Number(parsed.mrr) || 190,
    recomendacion,
    encaje: String(parsed.encaje ?? ''),
  }
}

// Extrae el subconjunto que se persiste en leads_os.analisis_brechas (jsonb).
export function toAnalisisBrechas(r: ResultadoBrechas): AnalisisBrechas {
  return {
    brechas: r.brechas,
    puntos_email: r.puntos_email,
    ahorro_estimado: r.ahorro_estimado,
    recomendacion: r.recomendacion,
    encaje: r.encaje,
  }
}

/* ─────────────────────────────────────────────
   SIMULADOR DE VENTAS
   La IA encarna un cliente resistente de un sector dado.
   modo 'responder' → siguiente réplica del cliente.
   modo 'evaluar'   → feedback final del rendimiento del vendedor.
   ───────────────────────────────────────────── */
export async function simularRespuestaCliente(
  sectorId: string,
  resistencia: Resistencia,
  historial: ChatMsg[],
  modo: 'responder' | 'evaluar'
): Promise<string> {
  const sector = SECTORES.find((s) => s.id === sectorId) ?? SECTORES[0]
  const res = RESISTENCIAS[resistencia]

  const systemResponder = `Estás haciendo un ROLEPLAY de entrenamiento de ventas.
Encarnas a un POSIBLE CLIENTE de WIARE, una agencia que vende un agente de voz IA + CRM
a negocios locales en España (790€ de setup + 90-390€/mes, sin permanencia).

TU PERSONAJE: ${sector.perfil}
NIVEL: ${res.label}. ${res.instruccion}

OBJECIONES QUE PUEDES USAR (no todas a la vez, de forma natural):
${sector.objeciones.map((o) => `- "${o}"`).join('\n')}

REGLAS:
- Responde SIEMPRE en primera persona como el cliente, en español de España, natural y coloquial.
- Mensajes cortos (1-4 frases), como una conversación real por teléfono.
- NO ayudes al vendedor ni le des pistas. Reacciona a lo que dice.
- Si el vendedor maneja bien tus objeciones y aporta valor real, ve cediendo de forma realista según tu nivel.
- Si te convence del todo, acepta agendar una demo y dilo claramente.
- Nunca rompas el personaje ni hables como IA.`

  const systemEvaluar = `Eres un COACH de ventas senior. Acabas de observar un roleplay
donde un vendedor de WIARE (agente de voz IA + CRM para negocios locales) intentaba
convencer a un cliente del sector "${sector.label}" (nivel ${res.label}).

Evalúa el desempeño del VENDEDOR (los mensajes con role "user" del historial).
Responde en Markdown, en español, conciso y accionable:

## Nota: X/10

## Lo que hiciste bien
[2-3 puntos concretos citando lo que dijo]

## Lo que fallaste
[2-3 puntos: objeciones no cerradas, oportunidades perdidas]

## Tu próxima jugada
[1-2 consejos concretos para mejorar el cierre]

Sé honesto y directo. Si el pitch fue flojo, dilo. Sin florituras.`

  if (modo === 'evaluar') {
    // Para evaluar, convertimos el historial en una transcripción legible.
    const transcripcion = historial
      .map((m) => `${m.role === 'user' ? 'VENDEDOR' : 'CLIENTE'}: ${m.content}`)
      .join('\n')
    return guardedCall('content', () =>
      callClaudeChat(
        'claude-haiku-4-5',
        800,
        [{ role: 'user', content: `Transcripción del roleplay:\n\n${transcripcion}\n\nEvalúa al vendedor.` }],
        systemEvaluar
      )
    )
  }

  return guardedCall('content', () =>
    callClaudeChat('claude-haiku-4-5', 350, historial, systemResponder)
  )
}

/* ─────────────────────────────────────────────
   CONSULTOR IA
   Chat interno con todo el contexto de WIARE precargado.
   ───────────────────────────────────────────── */
export async function consultarIA(historial: ChatMsg[]): Promise<string> {
  return guardedCall('content', () =>
    callClaudeChat('claude-haiku-4-5', 700, historial, WIARE_CONTEXTO)
  )
}
