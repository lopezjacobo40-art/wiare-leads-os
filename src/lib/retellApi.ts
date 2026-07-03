import { authHeaders, type Lead } from './supabaseClient'


// Voz española de la cuenta de Retell
const VOICE_FALLBACKS = ['custom-Carolina']

export async function crearAgentDemo(lead: Lead, systemPrompt: string): Promise<string> {
  // 1. Crear el LLM de Retell con el prompt
  const llmRes = await fetch('/api/retell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      endpoint: '/create-retell-llm',
      payload: {
        general_prompt: systemPrompt,
        begin_message: `Hola, gracias por llamar a ${lead.nombre}. ¿En qué puedo ayudarte?`,
      }
    }),
  })
  if (!llmRes.ok) {
    const err = await llmRes.text()
    throw new Error(`Retell LLM error ${llmRes.status}: ${err}`)
  }
  const llm = await llmRes.json()

  // 2. Crear el agente — probando voces en orden hasta que una funcione
  let ultimoError = ''
  for (const voiceId of VOICE_FALLBACKS) {
    const res = await fetch('/api/retell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        endpoint: '/create-agent',
        payload: {
          agent_name: `Demo ${lead.nombre} — WIARE`,
          voice_id: voiceId,
          language: 'es-ES',
          voice_speed: 1.0,
          voice_temperature: 0.9,
          responsiveness: 1.0,
          interruption_sensitivity: 0.8,
          enable_backchannel: true,
          backchannel_frequency: 0.8,
          response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        }
      }),
    })

    if (res.ok) {
      const agent = await res.json()
      return agent.agent_id
    }

    ultimoError = `${res.status}: ${await res.text()}`
    // Si el fallo no es por la voz, no merece la pena seguir probando voces
    if (!ultimoError.toLowerCase().includes('voice')) break
  }

  throw new Error(`Retell agent error ${ultimoError}`)
}
