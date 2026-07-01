import type { Lead, AnalisisBrechas } from './supabaseClient'
import { guardedCall } from './tokenGuard'
import { SECTORES, RESISTENCIAS, type Resistencia } from './simuladorData'
import { WIARE_CONTEXTO } from './wiareContexto'
import { getNichoBrechas } from './brechasConfig'
import { callGemini } from './geminiApi'
import { fetchWithAudit } from './apiAuditor'

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
  const fallbackGemini = async () => {
    // Si falla Claude, traducimos el formato a Gemini
    let geminiPrompt = system ? `${system}\n\n` : ''
    geminiPrompt += messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    // El LLM de fallback usará geminiApi.ts, el cual también debería estar auditado (luego)
    const geminiText = await callGemini(geminiPrompt)
    // Devolvemos una Response ficticia para mantener la firma (aunque fetchWithAudit devuelve Response,
    // en su código de fallback espera Promise<Response>. Wait, if fallback returns Response...
    // Actually, fallback in fetchWithAudit returns Response, but we can just throw and handle it differently.
    return new Response(JSON.stringify({ content: [{ text: geminiText }] }), { status: 200 })
  }

  const res = await fetchWithAudit(API_URL, {
    method: 'POST',
    service: 'Claude',
    retries: 2,
    fallback: fallbackGemini,
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
  icebreaker: string
  email_asunto?: string
  email_cuerpo?: string
}

export interface DialogoAudio {
  speaker: 'cliente' | 'ai'
  text: string
}

export async function generarGuionAudio(lead: Lead): Promise<DialogoAudio[]> {
  const prompt = `Actúas como un guionista de demostraciones de voz AI. Tu objetivo es escribir un diálogo ultra-realista de 3 o 4 frases como máximo entre un "cliente" (el prospecto llamando por teléfono) y la "ai" (la recepcionista virtual de WIARE trabajando para este negocio en específico).

Datos del negocio:
Nombre: ${lead.nombre}
Sector: ${lead.sector}
Descripción: ${lead.descripcion ?? 'Negocio local'}

REGLAS:
- No escribas nada más, devuelve SOLO un array JSON válido sin formato markdown ni comillas raras.
- El JSON debe ser exactamente: [{"speaker": "cliente", "text": "..."}, {"speaker": "ai", "text": "..."}]
- La IA debe sonar extremadamente profesional, rápida y demostrar que conoce el sector (ofrecer mesa, cita médica, consulta legal, etc.).
- Hazlo corto (máximo 4 intercambios) para que dure 30 segundos.
- Empieza siempre el cliente diciendo algo como "Hola, quería..." o "Llamaba para...".`

  const messages: ChatMsg[] = [{ role: 'user', content: prompt }]
  
  return await guardedCall('score', async () => {
    // Usamos el modelo rápido (Haiku) para la demo instantánea.
    const raw = await callClaudeChat('claude-haiku-4-5', 400, messages)
    try {
      // Extraemos el JSON por si Claude mete algo de texto
      const jsonStr = raw.match(/\[.*\]/s)?.[0] ?? raw
      return JSON.parse(jsonStr) as DialogoAudio[]
    } catch {
      // Fallback genérico si falla el parseo
      return [
        { speaker: 'cliente', text: `Hola, llamaba a ${lead.nombre} para hacer una consulta.` },
        { speaker: 'ai', text: 'Hola, soy la recepcionista virtual inteligente de este negocio. Puedo ayudarle a reservar su cita o gestionar su consulta 24 horas al día. ¿En qué le ayudo?' }
      ]
    }
  })
}

export async function analizarBrechas(lead: Lead): Promise<ResultadoBrechas> {
  const nicho = getNichoBrechas(lead.sector)
  const horario = Array.isArray(lead.horario)
    ? lead.horario.join('; ')
    : lead.horario
      ? JSON.stringify(lead.horario)
      : 'Desconocido'

  const prompt = `CONTEXTO Y PERSONA: Actúas como el clon digital de Alex Hormozi. Eres un maestro en ventas B2B, creación de "Grand Slam Offers" y psicología de conversión.
Tu misión es cualificar leads para WIARE, una agencia que instala un sistema de atención 24/7 (agente de voz IA + CRM) para negocios locales en España que pierden clientes por no coger el teléfono.

REGLA FUNDAMENTAL: La mayoría de negocios NO son clientes ideales. Sé brutalmente honesto.
Si el encaje es débil, puntuación BAJA (1-4) y recomendación DESCARTAR. No infles el score.

DATOS DEL NEGOCIO (Google Maps):
Nombre: ${lead.nombre}
Decisor: ${lead.decisor_nombre ?? 'Desconocido'} (${lead.decisor_cargo ?? ''})
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
- Cadena o franquicia (ya tiene centralita)
- Sector con atención online ya resuelta
- Horario 24/7 ya cubierto o sin citas
- Pocas reseñas + sin web = negocio pequeño sin presupuesto

CUÁNDO PUNTUAR ALTO (7-10) y CONTACTAR:
- Clínica/peluquería/restaurante con horario limitado y muchas reseñas
- Sector donde la cita previa es crítica

LENGUAJE: NUNCA "IA", "bot", "algoritmo". SÍ "atención", "recepción", "clientes perdidos".

EMAIL DE OUTREACH PERSONALIZADO (ESTILO ALEX HORMOZI - 100% HUMANO Y CASUAL):
Debes redactar un correo de venta en frío hiper-personalizado y su respectivo asunto en base a los datos de este negocio. Debe sonar 100% escrito a mano, sincero, casual y directo.

REGLAS DE REDACCIÓN:
1. LIMPIEZA DE NOMBRE: Limpia el nombre del negocio. Si el nombre en Google Maps incluye slogans o frases SEO (ej: "Clínica Moratín Podología || podólogo centro de Madrid"), acórtalo a lo que diría un humano (ej: "Clínica Moratín" o "Clínica Moratín Podología").
2. ASUNTO (email_asunto): Un asunto muy corto, de 2 a 4 palabras, en minúsculas y casual que genere curiosidad (ej: "pregunta rápida", "duda sobre vuestras llamadas", "duda sobre {{nombre_limpio}}").
3. CUERPO (email_cuerpo): Debe seguir estrictamente la siguiente estructura y orden:
   - Saludo y Presentación (muy breve): "Hola [Nombre decisor si se conoce, sino general], soy Jacobo, cofundador de WIARE." (alternar aleatoriamente firmando como Luis: "soy Luis, cofundador de WIARE.").
   - Propuesta de valor breve: Qué hace WIARE adaptado a su sector (ej: "ayudamos a clínicas dentales a recuperar llamadas perdidas de pacientes fuera de horario").
   - Por qué nos hemos fijado en su negocio: "Me he fijado en [Nombre limpio] porque..." (ej: "tenéis excelentes reseñas en Valencia pero vuestro horario de atención es limitado, por lo que seguro que perdéis llamadas cuando estáis cerrados").
   - Dolor/Coste: Traduce la pérdida a cifras concretas de dinero/clientes perdidos al mes basándote en su sector y volumen de reseñas (ej: "Haciendo números, un negocio de vuestro tamaño suele perder 6-8 llamadas a la semana. Con vuestro ticket medio, eso son fácilmente 2.500€/mes que se van directos a la competencia.").
   - CTA ÚNICO DE FRICCIÓN CERO (WhatsApp): Pide permiso para pasarle la demo por WhatsApp (ej: "Si te cuadra, ¿te puedo pasar un audio de 30 segundos por WhatsApp para que escuches cómo sonaría tu propia recepcionista automática contestando con el nombre de [Nombre limpio]?").
   - Firma: "Un saludo, Jacobo" (o "Un saludo, Luis", coincidiendo con el remitente inicial).
   - IMPORTANTE: No metas listas de viñetas, guiones ni estructures el email como un folleto de ventas. Debe fluir como un correo de texto plano rápido enviado desde el móvil.
   - NUNCA incluyas múltiples CTAs. El único CTA debe ser el de WhatsApp.

PROHIBICIONES ABSOLUTAS (Incumplirlas arruinará la venta):
1. PROHIBIDO saludar con "Estimado/a", "Espero que este email le encuentre bien", "Es un placer", "Le escribo porque". (Se permite y exige presentarse como "soy Jacobo/Luis, cofundador de WIARE").
2. PROHIBIDO usar palabras de marketing trilladas como "optimizar", "revolucionar", "solución integral", "plataforma innovadora", "agilizar procesos", "potenciar", "incrementar".
3. PROHIBIDO incluir guiones, viñetas, o listas numeradas en el email.
4. PROHIBIDO despedirse con "Atentamente", "Cordialmente", "Quedo a la espera de sus comentarios". Usa "Un saludo, Jacobo" (o Luis).
5. El email entero no debe superar las 90-110 palabras y debe tener estructura de texto plano (párrafos de 1 o 2 líneas como mucho). Debe parecer escrito a toda prisa desde un teléfono móvil.

Genera el análisis estructurado del negocio.
`

  const schema = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        score: { type: 'integer' },
        recomendacion: { type: 'string', enum: ['contactar', 'dudoso', 'descartar'] },
        encaje: { type: 'string' },
        resumen: { type: 'string' },
        brechas: {
          type: 'array',
          items: { type: 'string' }
        },
        puntos_email: {
          type: 'array',
          items: { type: 'string' }
        },
        ahorro_estimado: { type: 'string' },
        volumen: { type: 'string', enum: ['bajo', 'medio', 'alto', 'muy_alto'] },
        mrr: { type: 'integer' },
        icebreaker: { type: 'string' },
        email_asunto: { type: 'string' },
        email_cuerpo: { type: 'string' }
      },
      required: ['score', 'recomendacion', 'encaje', 'resumen', 'brechas', 'puntos_email', 'ahorro_estimado', 'volumen', 'mrr', 'icebreaker', 'email_asunto', 'email_cuerpo']
    },
    thinkingConfig: {
      thinkingBudget: 0
    }
  }

  const text = await guardedCall('score', () => callGemini(prompt, schema))
  
  let parsed: any
  try {
    const json = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(json)
  } catch (err: any) {
    console.error('Error parsing Gemini response:', err, 'Raw response was:', text)
    throw new Error(`Error al procesar el análisis (JSON inválido): ${err.message}`)
  }
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
    icebreaker: String(parsed.icebreaker ?? ''),
    email_asunto: String(parsed.email_asunto ?? ''),
    email_cuerpo: String(parsed.email_cuerpo ?? ''),
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
    email_asunto: r.email_asunto,
    email_cuerpo: r.email_cuerpo,
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

/* ─────────────────────────────────────────────
   CONTENT OS — GENERADOR DE POSTS
   Genera un post estructurado (gancho + cuerpo + CTA + hashtags)
   para Instagram o LinkedIn, adaptado al sector/voz de WIARE.
   ───────────────────────────────────────────── */

export interface PostGenerado {
  gancho: string
  cuerpo: string[]  // array de partes / párrafos del hilo
  cta: string
  hashtags: string
}

const TIPO_LABELS: Record<string, string> = {
  tip: 'Tip educativo',
  caso_cliente: 'Caso de cliente',
  autoridad: 'Post de autoridad',
  detras_camaras: 'Detrás de cámaras',
  objecion: 'Objeción respondida',
  tendencia: 'Tendencia del sector',
}

const TONO_LABELS: Record<string, string> = {
  cercano: 'cercano y conversacional (tú directo, como si fuera un DM entre conocidos)',
  profesional: 'profesional y claro (directo al grano, sin tecnicismos innecesarios)',
  directo: 'directo y rotundo (afirmaciones fuertes, nada de suavizar)',
}

/* ─────────────────────────────────────────────
   CONTENT OS — CALENDARIO MENSUAL
   Genera un plan editorial completo para un mes dado.
   Devuelve un array de entradas: fecha + red social + tipo + tema sugerido.
   ───────────────────────────────────────────── */

export interface EntradaCalendario {
  fecha: string          // ISO date 'YYYY-MM-DD'
  red_social: 'instagram' | 'linkedin'
  tipo_post: string
  tema: string
}

export async function generarCalendarioMensual(params: {
  mes: number   // 1-12
  anio: number
}): Promise<EntradaCalendario[]> {
  const { mes, anio } = params
  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const prompt = `Eres el community manager de WIARE Solutions, agencia española de agentes de voz IA para negocios locales (clínicas, restaurantes, peluquerías, etc.).

Crea un plan editorial completo para ${nombreMes}.

FRECUENCIA ÓPTIMA:
- Instagram: 3 posts por semana (lunes, miércoles, viernes preferentemente)
- LinkedIn: 2 posts por semana (martes y jueves preferentemente)

TIPOS DE POST DISPONIBLES (alterna, no repitas el mismo más de 2 semanas seguidas):
- tip: Tip educativo práctico del sector
- caso_cliente: Historia de éxito real de un cliente WIARE
- autoridad: Post de autoridad / posicionamiento experto
- detras_camaras: Detrás de cámaras del equipo WIARE
- objecion: Objeción común respondida
- tendencia: Tendencia del sector IA / voz / automatización

WIARE: agente de voz que atiende llamadas 24/7 + CRM para negocios locales España. 790€ setup + 90-390€/mes.

Para cada entrada devuelve: fecha exacta (solo días laborables, no festivos nacionales), red social, tipo de post, y un tema concreto y específico (1 frase, no genérica).

Responde SOLO en JSON con esta estructura:
{
  "entradas": [
    { "fecha": "YYYY-MM-DD", "red_social": "instagram", "tipo_post": "tip", "tema": "..." },
    ...
  ]
}`

  const text = await guardedCall('content', () =>
    callClaudeChat('claude-haiku-4-5-20251001', 2000, [{ role: 'user', content: prompt }])
  )

  let parsed: { entradas: EntradaCalendario[] }
  try {
    const json = text.replace(/```json\n?|```/g, '').trim()
    parsed = JSON.parse(json)
  } catch (parseErr) {
    console.error('generarCalendarioMensual parse error. Raw:', text, parseErr)
    throw new Error('Error al generar el calendario (respuesta inválida)')
  }

  return (parsed.entradas ?? []).filter((e) =>
    e.fecha && e.red_social && e.tipo_post && e.tema
  )
}

export async function generarPost(params: {
  redSocial: 'instagram' | 'linkedin'
  tipoPost: string
  tema: string
  tono: string
}): Promise<PostGenerado> {
  const { redSocial, tipoPost, tema, tono } = params

  const instrRed =
    redSocial === 'instagram'
      ? 'Para Instagram: gancho con máximo 2 líneas que pare el scroll, cuerpo de 3-5 párrafos cortos (máx 4 líneas cada uno), CTA con invitación a comentar o DM, hashtags relevantes (8-12).'
      : 'Para LinkedIn: gancho potente en 1-2 líneas, cuerpo de 4-6 párrafos con salto de línea entre cada uno, CTA profesional (reflexión o pregunta), hashtags relevantes (4-6).'

  const prompt = `Eres el community manager de WIARE Solutions, agencia española de agentes de voz IA para negocios locales (clínicas, restaurantes, peluquerías, etc.).
Producto: agente de voz que atiende llamadas 24/7 + CRM. Precio: 790€ setup + 90-390€/mes.
Posicionamiento: autoridad técnica sin pedantería, cercanos, en España.

Genera un post de tipo "${TIPO_LABELS[tipoPost] ?? tipoPost}" sobre el tema: "${tema}".
Tono: ${TONO_LABELS[tono] ?? tono}.
${instrRed}

REGLAS:
- Sin emojis de relleno, solo si son naturales al tono.
- Sin "En el mundo de..." ni aperturas genéricas.
- El gancho debe generar curiosidad o apelar a un dolor real del dueño del negocio.
- No mencionar "IA" como palabra mágica; usa "agente de voz", "atención automática", "recepción 24/7".
- El CTA debe ser específico, no "¿qué opinas?".

Responde SOLO en JSON con esta estructura:
{
  "gancho": "...",
  "cuerpo": ["párrafo 1", "párrafo 2", "..."],
  "cta": "...",
  "hashtags": "..."
}`

  const text = await guardedCall('content', () =>
    callClaudeChat('claude-haiku-4-5-20251001', 1400, [{ role: 'user', content: prompt }])
  )

  let parsed: PostGenerado
  try {
    const json = text.replace(/```json\n?|```/g, '').trim()
    parsed = JSON.parse(json)
  } catch (parseErr) {
    console.error('generarPost parse error. Raw text:', text, parseErr)
    throw new Error('Error al generar el post (respuesta inválida)')
  }
  return {
    gancho: String(parsed.gancho ?? ''),
    cuerpo: Array.isArray(parsed.cuerpo) ? parsed.cuerpo.map(String) : [],
    cta: String(parsed.cta ?? ''),
    hashtags: String(parsed.hashtags ?? ''),
  }
}

export interface DatosDecisor {
  nombre: string
  cargo: string
}

export async function extraerDatosDecisor(
  textSnippet: string,
  nombreEmpresa: string
): Promise<DatosDecisor | null> {
  const prompt = `Eres un experto analista de datos B2B. 
Tengo el siguiente resultado de búsqueda de Google (de un perfil de LinkedIn) buscando al fundador o dueño de la empresa "${nombreEmpresa}".

Snippet de búsqueda:
"${textSnippet}"

Tu tarea es extraer el NOMBRE COMPLETO y el CARGO EXACTO de esta persona.
Si el snippet no parece contener el nombre de una persona real asociada a la empresa, devuelve valores vacíos.

Responde SOLO en JSON con esta estructura:
{
  "nombre": "Nombre Apellido",
  "cargo": "Fundador / CEO / Propietario / Director"
}`

  const text = await guardedCall('score', () =>
    callClaudeChat('claude-haiku-4-5-20251001', 500, [{ role: 'user', content: prompt }])
  )

  let parsed: Partial<DatosDecisor>
  try {
    let json = text
    // Intentar extraer de bloque de código si existe
    const match = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (match && match[1]) {
      json = match[1]
    } else {
      // Si no hay bloque, intentar extraer desde la primera { hasta la última }
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        json = text.slice(start, end + 1)
      }
    }
    parsed = JSON.parse(json)
  } catch (parseErr) {
    console.error('extraerDatosDecisor parse error. Raw text:', text, parseErr)
    return null
  }

  if (!parsed.nombre || parsed.nombre.trim() === '') return null

  return {
    nombre: String(parsed.nombre).trim(),
    cargo: String(parsed.cargo || 'Dueño/Propietario').trim()
  }
}
