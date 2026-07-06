import { supabase, usernameFromSession, type Lead } from './supabaseClient'

/* ─────────────────────────────────────────────
   Secuencia de cold email — 4 toques y archivo.

   toque 1 (D0):  email inicial      → siguiente en 3 días (email corto)
   toque 2 (D3):  email follow-up    → siguiente en 4 días (WhatsApp)
   toque 3 (D7):  WhatsApp/llamada   → siguiente en 7 días (email breakup)
   toque 4 (D14): email breakup      → fin: se archiva en 'sin_respuesta'

   Cada envío/toque queda en lead_touches_os (historial) y actualiza
   num_toques, ultimo_toque_at y el próximo toque en leads_os.
   ───────────────────────────────────────────── */

export type TipoToque = 'Email' | 'WhatsApp' | 'Llamada'

const SECUENCIA: { dias: number; tipo: TipoToque }[] = [
  { dias: 3, tipo: 'Email' },
  { dias: 4, tipo: 'WhatsApp' },
  { dias: 7, tipo: 'Email' },
]

/* Siguiente paso tras haber completado `numToques` toques; null = secuencia agotada. */
export function siguientePaso(numToques: number): { dias: number; tipo: TipoToque } | null {
  return SECUENCIA[numToques - 1] ?? null
}

function enDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

async function usuarioActual(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return usernameFromSession(session) ?? 'desconocido'
}

async function insertarToque(leadId: string, tipo: TipoToque, nota: string | null) {
  const { error } = await supabase
    .from('lead_touches_os')
    .insert({ lead_id: leadId, tipo, nota })
  if (error) console.error('Error guardando historial de toque:', error.message)
}

/* Registra el envío de un email: fase, timestamp, copy usado, historial y
   auto-programación del siguiente toque. Devuelve los campos actualizados
   para que el caller pueda refrescar su estado local sin re-fetch. */
export async function registrarEnvioEmail(
  lead: Lead,
  email?: { asunto: string; cuerpo: string } | null
): Promise<{ error: string | null; campos?: Partial<Lead> }> {
  const ahora = new Date().toISOString()
  const numToques = (lead.num_toques ?? 0) + 1
  const siguiente = siguientePaso(numToques)

  const campos: Partial<Lead> = {
    fase: 'email_enviado',
    email_enviado_at: lead.email_enviado_at ?? ahora,
    num_toques: numToques,
    ultimo_toque_at: ahora,
    proximo_toque_fecha: siguiente ? enDias(siguiente.dias) : null,
    proximo_toque_tipo: siguiente?.tipo ?? null,
  }
  // Persistir el copy realmente usado (sin pisar uno ya guardado)
  if (email && !lead.outreach_cuerpo) {
    campos.outreach_asunto = email.asunto
    campos.outreach_cuerpo = email.cuerpo
  }

  const { error } = await supabase.from('leads_os').update(campos).eq('id', lead.id)
  if (error) return { error: error.message }

  await insertarToque(lead.id, 'Email', email?.asunto ?? lead.outreach_asunto ?? null)
  await supabase.from('token_usage_os').insert({
    usuario: await usuarioActual(),
    accion: 'email_enviado',
    tokens_estimados: 0,
  })
  return { error: null, campos }
}

/* Marca el toque programado como hecho: historial + siguiente paso de la
   secuencia. Si era el último y el lead sigue sin responder (fase
   email_enviado), se archiva en 'sin_respuesta'. */
export async function registrarToqueHecho(
  lead: Lead,
  nota?: string
): Promise<{ archivado: boolean; error: string | null; campos?: Partial<Lead> }> {
  const ahora = new Date().toISOString()
  const numToques = (lead.num_toques ?? 0) + 1
  const siguiente = siguientePaso(numToques)
  const archivar = !siguiente && lead.fase === 'email_enviado'

  const campos: Partial<Lead> = {
    num_toques: numToques,
    ultimo_toque_at: ahora,
    proximo_toque_fecha: siguiente ? enDias(siguiente.dias) : null,
    proximo_toque_tipo: siguiente?.tipo ?? null,
  }
  if (archivar) campos.fase = 'sin_respuesta'

  const { error } = await supabase.from('leads_os').update(campos).eq('id', lead.id)
  if (error) return { archivado: false, error: error.message }

  await insertarToque(lead.id, lead.proximo_toque_tipo ?? 'Email', nota ?? null)
  return { archivado: archivar, error: null, campos }
}
