import type { Lead } from './supabaseClient'

const API_URL = 'https://api.anthropic.com/v1/messages'
const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude(model: string, maxTokens: number, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
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

  const text = await callClaude('claude-haiku-4-5', 300, prompt)
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

  return callClaude('claude-sonnet-4-6', 1500, prompt)
}

export async function generarPropuesta(lead: Lead): Promise<string> {
  const mrr = lead.mrr_estimado ?? 190
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

  return callClaude('claude-sonnet-4-6', 2000, prompt)
}
