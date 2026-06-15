import type { Lead, AnalisisBrechas } from './supabaseClient'
import { guardedCall } from './tokenGuard'
import { SECTORES, RESISTENCIAS, type Resistencia } from './simuladorData'
import { WIARE_CONTEXTO } from './wiareContexto'
import { getNichoBrechas } from './brechasConfig'

const API_URL = 'https://api.anthropic.com/v1/messages'
const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude(model: string, maxTokens: number, prompt: string): Promise<string> {
  return callClaudeChat(model, maxTokens, [{ role: 'user', content: prompt }])
}

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
  score: number                  // 1-10, encaje del negocio con WIARE
  resumen: string                // informe profesional, 3-4 frases
  brechas: string[]              // 3 brechas detectadas
  puntos_email: string[]         // 3 puntos clave para el email (frases concretas)
  ahorro_estimado: string        // p.ej. "~1.200€/mes en reservas perdidas"
  volumen: 'bajo' | 'medio' | 'alto' | 'muy_alto'
  mrr: number                    // 90-390, alimenta la pestaña Costes
}

export async function analizarBrechas(lead: Lead): Promise<ResultadoBrechas> {
  const nicho = getNichoBrechas(lead.sector)
  const horario = Array.isArray(lead.horario)
    ? lead.horario.join('; ')
    : lead.horario
      ? JSON.stringify(lead.horario)
      : 'Desconocido'

  const prompt = `Eres consultor de WIARE. WIARE instala un sistema de atención al cliente
disponible 24/7 para negocios locales en España, que les hace AHORRAR DINERO Y TIEMPO
captando las llamadas y consultas que hoy pierden.

Analiza las BRECHAS de este negocio respecto a lo que WIARE puede resolverle.

DATOS REALES DEL NEGOCIO (de Google Maps):
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Ciudad: ${lead.ciudad ?? 'España'}
Valoración: ${lead.valoracion ?? 'N/D'}/5
Reseñas: ${lead.num_resenas ?? 0}
Tiene web: ${lead.web ? 'Sí' : 'No'}
Horario: ${horario}
Descripción: ${lead.descripcion ?? 'Sin descripción'}

CONOCIMIENTO DEL NICHO "${nicho.label}" (úsalo como guía, no lo copies literal):
Problema central del sector: ${nicho.problema_core}
Palancas que WIARE activa en este nicho:
${nicho.palancas.map((p) => `- ${p}`).join('\n')}

REGLAS ABSOLUTAS:
- NUNCA escribas "IA", "bot", "agente", "inteligencia artificial", "automatización", "algoritmo".
- SÍ usa lenguaje de negocio: "atención", "recepción", "respuesta", "ahorro", "clientes perdidos".
- Las brechas y los puntos deben ser ESPECÍFICOS de ESTE negocio (usa su horario, reseñas, sector, web/sin web), no genéricos.
- Los 3 "puntos_email" son frases concretas y persuasivas, listas para que un comercial las pegue en su plantilla de email. Cada punto en 1 frase.
- Sé honesto en el score: la mayoría de negocios buenos caen entre 5 y 8. Reserva 9-10 para encajes evidentes.

ESCALA DE SCORE (encaje con WIARE):
1-4: encaje débil (ya digitalizado, o problema que WIARE no resuelve)
5-7: buen encaje, merece contacto
8-10: encaje fuerte, contactar ya

Responde SOLO en JSON sin markdown:
{
  "score": número 1-10,
  "resumen": "informe profesional en 3-4 frases sobre las brechas de atención de este negocio y por qué WIARE le ahorra dinero/tiempo",
  "brechas": ["brecha 1 específica", "brecha 2 específica", "brecha 3 específica"],
  "puntos_email": ["punto 1 listo para el email", "punto 2", "punto 3"],
  "ahorro_estimado": "estimación realista, p.ej. ~1.200€/mes en reservas perdidas",
  "volumen": "bajo|medio|alto|muy_alto",
  "mrr": número entre 90 y 390
}`

  const text = await guardedCall('score', () => callClaude('claude-haiku-4-5', 800, prompt))
  const json = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(json)
  return {
    score: Math.max(0, Math.min(10, Number(parsed.score))),
    resumen: String(parsed.resumen ?? ''),
    brechas: Array.isArray(parsed.brechas) ? parsed.brechas.map(String).slice(0, 3) : [],
    puntos_email: Array.isArray(parsed.puntos_email) ? parsed.puntos_email.map(String).slice(0, 3) : [],
    ahorro_estimado: String(parsed.ahorro_estimado ?? ''),
    volumen: parsed.volumen ?? 'medio',
    mrr: Number(parsed.mrr) || 190,
  }
}

// Extrae el subconjunto que se persiste en leads_os.analisis_brechas (jsonb).
export function toAnalisisBrechas(r: ResultadoBrechas): AnalisisBrechas {
  return { brechas: r.brechas, puntos_email: r.puntos_email, ahorro_estimado: r.ahorro_estimado }
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
