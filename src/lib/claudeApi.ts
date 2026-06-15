import type { Lead } from './supabaseClient'
import { guardedCall } from './tokenGuard'
import { SECTORES, RESISTENCIAS, type Resistencia } from './simuladorData'
import { WIARE_CONTEXTO } from './wiareContexto'
import { getNicho } from './nichoConfig'

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

export interface ScoreResult {
  score: number
  motivo: string
  volumen: 'bajo' | 'medio' | 'alto' | 'muy_alto'
  mrr: number
}

export async function scoreLead(lead: Lead): Promise<ScoreResult> {
  const horario = lead.horario ? lead.horario.join('; ') : 'Desconocido'
  const prompt = `Analiza este negocio local español como lead para agente de voz IA + CRM.
Precio del servicio: 790€ setup + 90-390€/mes.
Nombre: ${lead.nombre}, Sector: ${lead.sector},
Valoración: ${lead.valoracion ?? 'N/D'}/5, Reseñas: ${lead.num_resenas ?? 0},
Web: ${lead.web ? 'Sí' : 'No'}, Horario: ${horario}
Criterios: +3 si >100 reseñas, +2 sin web, +2 si val>4,
+2 horario limitado, +1 sector premium.
Responde SOLO JSON sin markdown:
{"score":0-10, "motivo":"1 frase", "volumen":"bajo/medio/alto/muy_alto", "mrr":90-390}`

  const text = await guardedCall('score', () => callClaude('claude-haiku-4-5', 300, prompt))
  const json = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(json)
  return {
    score: Math.max(0, Math.min(10, Number(parsed.score))),
    motivo: String(parsed.motivo),
    volumen: parsed.volumen,
    mrr: Number(parsed.mrr),
  }
}

const TONOS: Record<string, string> = {
  Restaurante: 'cercano, objetivo: reserva confirmada',
  Clínica: 'profesional, objetivo: cita agendada',
  Inmobiliaria: 'comercial, objetivo: visita agendada',
  Academia: 'motivador, objetivo: info + llamada con asesor',
  Taller: 'directo, objetivo: cita de diagnóstico',
  Peluquería: 'amigable, objetivo: cita con servicio',
  Hotel: 'cordial, objetivo: reserva o información',
  Gimnasio: 'energético, objetivo: prueba gratuita',
  Farmacia: 'cercano, objetivo: resolver consulta',
}

export async function generarSystemPrompt(lead: Lead): Promise<string> {
  const tono = TONOS[lead.sector] ?? 'profesional y cercano, objetivo: agendar cita'
  const horario = lead.horario ? lead.horario.join('; ') : 'Desconocido'
  const prompt = `Genera system prompt completo para Sofía, agente de voz IA de WIARE,
personalizado para: ${lead.nombre} (${lead.sector})
Dirección: ${lead.direccion ?? 'N/D'}, Val: ${lead.valoracion ?? 'N/D'}/5,
Reseñas: ${lead.num_resenas ?? 0}, Horario: ${horario}
Tono: ${tono}
Requisitos:
1. Se presenta como asistente de ${lead.nombre}
2. Español España, natural, sin sonar robot
3. Exactamente 8 FAQs específicas del negocio
4. Flujo: saludo→necesidad→cualificar→agendar
5. Recoger: nombre, teléfono, necesidad, fecha preferida
6. Si no puede resolver: recoge datos y promete llamada
Genera SOLO el system prompt.`

  return guardedCall('content', () => callClaude('claude-sonnet-4-6', 1500, prompt))
}

export async function generarPropuesta(lead: Lead): Promise<string> {
  const mrr = lead.mrr_estimado ?? 190

  // ── Lead venido de la calculadora de wiaresolution.com ──
  // Ya validó su dolor (calculó su pérdida real) → propuesta basada en SUS cifras.
  const esLeadWeb = lead.fuente === 'web_calculadora' && (lead.perdida_mensual_real ?? 0) > 0

  if (esLeadWeb) {
    const perdida = lead.perdida_mensual_real ?? 0
    const payback = Math.ceil(790 / (perdida * 0.7))
    const porSemana = Math.round(perdida / 4)
    const promptWeb = `Genera una propuesta comercial ULTRA-PERSONALIZADA.
Este cliente YA calculó sus pérdidas en wiaresolution.com.
Usa sus números exactos — NUNCA estimes ni inventes cifras.

DATOS REALES DEL CLIENTE:
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Pérdida mensual que ÉL calculó: ${perdida.toLocaleString('es-ES')}€/mes
Pérdida anual: ${(perdida * 12).toLocaleString('es-ES')}€/año
Cada semana sin solución: ${porSemana.toLocaleString('es-ES')}€
Payback con WIARE: ${payback} semanas

SERVICIO WIARE:
Setup: 790€ único · Mantenimiento: ${mrr}€/mes
Sin permanencia · Activo en 7 días

CONTEXTO CLAVE PARA EL TONO:
Este cliente ya reconoció el problema — fue a nuestra web,
calculó sus pérdidas y dejó sus datos. El dolor está validado.
NO vendas el problema — ya lo sabe. Vende la solución y la urgencia.

ESTRUCTURA OBLIGATORIA (Markdown):

# Propuesta WIARE — ${lead.nombre}

## Ya lo sabes
[1 párrafo. Reconoce que calculó ${perdida.toLocaleString('es-ES')}€/mes de pérdida.
Valida que tomó una buena decisión al calcularlo.
Muchos empresarios prefieren no saber — tú sí quisiste saberlo.]

## Lo que hace nuestro sistema por ti
[Solución específica para ${lead.sector}.
3 beneficios concretos adaptados a su sector.
Sin tecnicismos.]

## Tu retorno exacto
| Concepto | Cifra |
|---|---|
| Pérdida actual | ${perdida.toLocaleString('es-ES')}€/mes |
| Recuperación estimada (70%) | ${Math.round(perdida * 0.7).toLocaleString('es-ES')}€/mes |
| Inversión WIARE | ${mrr}€/mes + 790€ setup |
| Beneficio neto mes 1 | ${Math.round(perdida * 0.7 - mrr).toLocaleString('es-ES')}€ |
| Payback del setup | ${payback} semanas |

## Qué incluye
- Agente de voz 24/7 personalizado para tu ${lead.sector}
- CRM con registro automático de cada lead
- Formación de 2 horas para tu equipo
- Soporte técnico incluido
- Sin permanencia — cancelas cuando quieras

## Activo en 7 días
1. Reunión de 30 min para configurar tu agente
2. Periodo de prueba y ajustes (48h)
3. Activación y primeras llamadas respondidas

## Tu inversión
**Setup:** 790€ (único) · **Mensual:** ${mrr}€ · **Sin permanencia**

## Cada semana que pasa son ${porSemana.toLocaleString('es-ES')}€ menos
[CTA directo. Recuerda que cada semana de espera son
${porSemana.toLocaleString('es-ES')}€ que no entran.
Propón empezar esta semana.]

Tono: directo, usa SUS números, crea urgencia real basada en datos.`

    return guardedCall('content', () => callClaude('claude-sonnet-4-6', 2000, promptWeb))
  }

  const prompt = `Genera propuesta comercial en Markdown para ${lead.nombre}.
Sector: ${lead.sector}, Ciudad: ${lead.ciudad ?? 'N/D'}
Reseñas: ${lead.num_resenas ?? 0}, Valoración: ${lead.valoracion ?? 'N/D'}
MRR recomendado: ${mrr}€/mes
Precio WIARE: 790€ setup + ${mrr}€/mes
Sin permanencia. Activación 7 días.

Estructura OBLIGATORIA en Markdown:
# Propuesta WIARE — ${lead.nombre}
## El problema que tienes ahora
[diagnóstico con pérdida mensual calculada]
## Lo que hace nuestro sistema
[solución específica para su sector, 3 beneficios]
## Tu retorno de inversión
[tabla inversión vs recuperación, payback en semanas]
## Qué incluye
[agente voz 24/7, CRM, formación, soporte]
## Activación en 3 pasos
## Inversión
Setup: 790€ | Mantenimiento: ${mrr}€/mes
## Empezamos esta semana
[CTA directo]
Tono: directo, números reales, sin florituras.`

  return guardedCall('content', () => callClaude('claude-sonnet-4-6', 2000, prompt))
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

/* ─────────────────────────────────────────────
   PROPUESTA SLIDES
   Genera el contenido JSON para el deck de 7 slides.
   Sonnet por calidad de redacción + personalización por nicho.
   ───────────────────────────────────────────── */

export interface SlidesContent {
  slide1: { tagline: string }
  slide2: { estadistica: string; pain_points: { titulo: string; descripcion: string }[] }
  slide3: { perdida_mensual: number; perdida_anual: number; sin_sistema: string[]; con_sistema: string[] }
  slide4: { titulo: string; beneficios: { icono: string; titulo: string; descripcion: string }[] }
  slide5: { pasos: string[] }
  slide6: { pregunta: string }
  slide7: { cta: string; tiene_demo: boolean }
}

export async function generarContenidoSlides(lead: Lead): Promise<SlidesContent> {
  const nicho = getNicho(lead.sector)
  const perdida = lead.perdida_mensual_real ?? nicho.perdida_mensual_ref

  const prompt = `
Eres un consultor de negocio que escribe propuestas
para WIARE. Escribes para dueños de negocios locales
en España que no saben nada de tecnología.

CONTEXTO DEL NEGOCIO:
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Ciudad: ${lead.ciudad ?? 'España'}
Valoración Google: ${lead.valoracion}/5
Reseñas: ${lead.num_resenas}
Horario: ${JSON.stringify(lead.horario)}
Descripción: ${lead.descripcion}
${perdida ? `Pérdida mensual calculada: ${perdida}€` : ''}

REFERENCIA DEL NICHO (adapta, no copies literal):
- Tagline base: "${nicho.tagline}"
- Estadística base: "${nicho.estadistica}"
- Pain points: ${JSON.stringify(nicho.pain_points)}
- Sin sistema: ${JSON.stringify(nicho.sin_sistema)}
- Con sistema: ${JSON.stringify(nicho.con_sistema)}
- Beneficios: ${JSON.stringify(nicho.beneficios)}
- Pasos: ${JSON.stringify(nicho.pasos)}
- Pregunta: "${nicho.pregunta}"
- CTA: "${nicho.cta}"

REGLAS ABSOLUTAS — violación = propuesta inválida:
1. NUNCA escribir: "IA", "inteligencia artificial", "agente",
   "bot", "LLM", "modelo", "automatización", "algoritmo"
2. NUNCA poner precios, tarifas ni costes
3. NUNCA usar lenguaje de startup o tech
4. SÍ usar: "recepcionista virtual", "sistema de atención",
   "tu negocio siempre disponible", "nunca más sin respuesta"
5. Hablar siempre de RESULTADOS para el negocio,
   nunca de cómo funciona la tecnología
6. Tono: consultor de confianza hablando con el dueño,
   no comercial de empresa tecnológica
7. perdida_mensual debe ser exactamente ${perdida} (no estimes)

SLIDE 1 — PORTADA:
tagline: frase de impacto específica para ESTE negocio.
Usa su nombre, su ciudad, su situación real.
Ejemplo bueno: "Pintxoterapia llena cada noche,
sin perder una sola reserva en Pozuelo"
Ejemplo malo: "Solución integral para su negocio"

SLIDE 2 — EL PROBLEMA:
estadistica: dato impactante del sector (real, no inventado)
pain_points: 3 problemas EMOCIONALES, no técnicos.
Escribe como si el dueño estuviera contándotelo:
"Los viernes el teléfono no para y yo estoy en cocina"
No: "Se producen pérdidas de llamadas en hora punta"

SLIDE 3 — EL COSTE:
perdida_mensual: ${perdida}
perdida_anual: ${perdida * 12}
frase_impacto: lo que significa ese dinero en términos reales
  "Son X mesas vacías cada mes" / "Son X pacientes que no vuelven"
sin_sistema: 3 consecuencias reales, en lenguaje humano
con_sistema: 3 cambios concretos, en lenguaje humano

SLIDE 4 — LA SOLUCIÓN:
titulo: promesa concreta para ESTE negocio
beneficios: 3 beneficios con icono Phosphor sugerido,
  escritos como resultados que el dueño va a vivir,
  no como características del servicio

SLIDE 5 — CÓMO FUNCIONA:
3 pasos MUY simples adaptados al sector.
El dueño de un restaurante no quiere saber de APIs.
Quiere saber: "llaman, se atiende, tú recibes la reserva"

SLIDE 6 — PAUSA:
pregunta: una pregunta incómoda pero justa.
Que le haga pensar. Personal para su negocio.
Ejemplo: "¿Cuántas llamadas perdiste el último fin de semana?"

SLIDE 7 — CTA:
cta: frase de cierre directa, sin presión, con confianza
tiene_demo: ${!!lead.agent_id_retell}
Si tiene demo: "Ya tenemos algo preparado para ti — solo necesitamos 15 minutos para mostrártelo"
Si no tiene demo: "En 48 horas podemos mostrarte exactamente cómo funcionaría en ${lead.nombre}"
contacto: info@wiaresolution.com

Devuelve SOLO el JSON sin markdown, con esta estructura exacta:
{
  "slide1": { "tagline": "" },
  "slide2": { "estadistica": "", "pain_points": [{"titulo":"","descripcion":""},{"titulo":"","descripcion":""},{"titulo":"","descripcion":""}] },
  "slide3": { "perdida_mensual": ${perdida}, "perdida_anual": ${perdida * 12}, "frase_impacto": "", "sin_sistema": ["","",""], "con_sistema": ["","",""] },
  "slide4": { "titulo": "", "beneficios": [{"icono":"","titulo":"","descripcion":""},{"icono":"","titulo":"","descripcion":""},{"icono":"","titulo":"","descripcion":""}] },
  "slide5": { "pasos": ["","",""] },
  "slide6": { "pregunta": "" },
  "slide7": { "cta": "", "tiene_demo": ${!!lead.agent_id_retell}, "contacto": "info@wiaresolution.com" }
}`

  const text = await guardedCall('content', () => callClaude('claude-sonnet-4-6', 1500, prompt))
  const json = text.replace(/```json|```/g, '').trim()
  return JSON.parse(json) as SlidesContent
}


/* ─────────────────────────────────────────────
   OUTREACH AGENT
   Genera estrategia + email personalizado para un lead.
   ───────────────────────────────────────────── */

export interface EstrategiaOutreach {
  angulo: string
  dolor_elegido: string
  dato_especifico: string
  opciones_asunto: string[]
  tono: 'cercano' | 'profesional' | 'directo'
  urgencia: string
}

export async function generarEstrategiaOutreach(lead: Lead): Promise<EstrategiaOutreach> {
  const prompt = `Analiza este lead y genera una estrategia de email en frío para contactarlo.
El vendedor es WIARE, agencia que instala un sistema de atención telefónica 24/7 para negocios locales en España.
Precio: 790€ setup + 90-390€/mes. Sin permanencia.

LEAD:
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Ciudad: ${lead.ciudad ?? 'España'}
Valoración Google: ${lead.valoracion ?? 'N/D'}/5
Reseñas: ${lead.num_resenas ?? 0}
Web: ${lead.web ? 'Sí' : 'No'}
Score WIARE: ${lead.score_cualificacion ?? 'N/D'}/10
Motivo score: ${lead.motivo_score ?? 'N/D'}

REGLAS ABSOLUTAS:
- NUNCA mencionar "IA", "bot", "agente", "automatización", "inteligencia artificial"
- SÍ usar: "sistema de atención", "recepcionista virtual", "solución"
- El dato_especifico debe ser algo real del lead (reseñas, sector, ciudad, valoración...)
- Las 3 opciones_asunto: máx 7 palabras cada una, distintas entre sí, sin click-bait

Devuelve SOLO JSON sin markdown:
{"angulo":"string","dolor_elegido":"string","dato_especifico":"string","opciones_asunto":["","",""],"tono":"cercano|profesional|directo","urgencia":"string"}`

  const text = await guardedCall('content', () => callClaude('claude-sonnet-4-6', 600, prompt))
  const json = text.replace(/```json|```/g, '').trim()
  return JSON.parse(json) as EstrategiaOutreach
}

export async function generarEmailOutreach(
  lead: Lead,
  _estrategia: EstrategiaOutreach,
  vendedor: string
): Promise<{ asunto: string; cuerpo: string; asuntos: string[]; asunto_recomendado: string }> {
  const prompt = `
Eres Jacobo, fundador de WIARE en Madrid.
Escribes emails en frío a dueños de negocios locales.

Tu estilo de email:
- Como si lo escribieras desde el móvil un martes por la mañana
- Máximo 5 líneas en el cuerpo. Nunca más.
- Primera línea: un detalle MUY específico del negocio
  (no "vi tu negocio en Google" — algo concreto como
  "Vi que tenéis ${lead.num_resenas} reseñas" o
  "Vi que cerráis los domingos" o algo del horario/descripción)
- Segunda línea: una pregunta directa sobre el problema.
  No afirmes que tienen el problema — pregunta.
- Tercera línea: lo que tienes para ellos.
  UNA frase. Vago pero intrigante.
- Cuarta línea: CTA. Solo una pregunta corta.
- Firma: solo tu nombre. Sin cargo, sin empresa, sin web.

PROHIBIDO absolutamente:
- "Nuestra solución", "nuestro sistema", "nuestro servicio"
- "IA", "inteligencia artificial", "agente", "bot", "automatización"
- "llamadas perdidas", "oportunidades", "potencial"
- Adjetivos: "eficiente", "innovador", "optimizado", "avanzado"
- Frases hechas: "en el mercado actual", "en el mundo digital"
- Más de 5 líneas en el cuerpo
- Mencionar la empresa WIARE en el cuerpo del email
- URLs en el cuerpo (solo si el CTA lo requiere)

OBLIGATORIO:
- Usar tuteo, no ustedeo
- Que suene como una persona, no como marketing
- El asunto: máximo 6 palabras, que genere curiosidad o
  señale un problema específico. Nunca genérico.
- 3 opciones de asunto diferentes en tono e ángulo

Datos del negocio:
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Ciudad: ${lead.ciudad}
Valoración: ${lead.valoracion}/5
Reseñas: ${lead.num_resenas}
Horario: ${JSON.stringify(lead.horario)}
Descripción: ${lead.descripcion}
Firmante: ${vendedor}

Responde SOLO en JSON:
{
  "asuntos": ["opción 1", "opción 2", "opción 3"],
  "cuerpo": "el email completo listo para enviar",
  "asunto_recomendado": "cuál de los 3 y por qué en 1 frase"
}
`

  const text = await guardedCall('content', () => callClaude('claude-haiku-4-5-20251001', 500, prompt))
  const json = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(json) as { asuntos: string[]; cuerpo: string; asunto_recomendado: string }
  return {
    ...parsed,
    asunto: parsed.asuntos[0] ?? '',
  }
}
