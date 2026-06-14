import type { Lead } from './supabaseClient'
import { guardedCall } from './tokenGuard'

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
