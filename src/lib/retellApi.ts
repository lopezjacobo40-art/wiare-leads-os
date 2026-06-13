import type { Lead } from './supabaseClient'

const KEY = import.meta.env.VITE_RETELL_API_KEY

export async function crearAgentDemo(lead: Lead, systemPrompt: string): Promise<string> {
  // 1. Crear el LLM de Retell con el prompt
  const llmRes = await fetch('https://api.retellai.com/create-retell-llm', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      general_prompt: systemPrompt,
      begin_message: `Hola, gracias por llamar a ${lead.nombre}. Soy el asistente virtual, ¿en qué puedo ayudarte?`,
    }),
  })
  if (!llmRes.ok) {
    const err = await llmRes.text()
    throw new Error(`Retell LLM error ${llmRes.status}: ${err}`)
  }
  const llm = await llmRes.json()

  // 2. Crear el agente vinculado al LLM
  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_name: `Sofía — Demo ${lead.nombre}`,
      voice_id: 'es-ES-ElviraNeural',
      language: 'es-ES',
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Retell agent error ${res.status}: ${err}`)
  }
  const agent = await res.json()
  return agent.agent_id
}
