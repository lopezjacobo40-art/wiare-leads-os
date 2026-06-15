import type { Lead } from './supabaseClient'

/* ─────────────────────────────────────────────
   Cliente de exportación a Google Sheets.
   La lógica real (OAuth2 + Sheets API) vive en la API route
   serverless /api/export-sheets — aquí solo enviamos los leads
   y devolvemos la URL del sheet creado/actualizado.
   ───────────────────────────────────────────── */

// Campos que el endpoint necesita de cada lead (subconjunto de Lead).
function aDTO(lead: Lead) {
  return {
    id: lead.id,
    created_at: lead.created_at,
    nombre: lead.nombre,
    sector: lead.sector,
    ciudad: lead.ciudad,
    direccion: lead.direccion,
    telefono: lead.telefono,
    web: lead.web,
    google_maps_url: lead.google_maps_url,
    valoracion: lead.valoracion,
    num_resenas: lead.num_resenas,
    score_cualificacion: lead.score_cualificacion,
    motivo_score: lead.motivo_score,
    volumen_llamadas: lead.volumen_llamadas,
    fase: lead.fase,
    mrr_estimado: lead.mrr_estimado,
    agent_id_retell: lead.agent_id_retell,
    propuesta_md: lead.propuesta_md,
    notas: lead.notas,
    // ── campos v5 ──
    email: lead.email,
    email_verificado: lead.email_verificado,
    email_fuente: lead.email_fuente,
    fuente: lead.fuente,
    // ── campos funnel completos ──
    outreach_asunto: lead.outreach_asunto,
    outreach_cuerpo: lead.outreach_cuerpo,
    horario: lead.horario,
    perdida_mensual_real: lead.perdida_mensual_real,
    perdida_anual_real: lead.perdida_anual_real,
    extraccion_fecha: lead.extraccion_fecha,
    propuesta_slides: lead.propuesta_slides,
    propuesta_tipo: lead.propuesta_tipo,
    tag: lead.tag,
    descripcion: lead.descripcion,
  }
}

export interface ExportResult {
  url: string
  total: number
  updated: number
  created: number
}

export async function exportarASheets(leads: Lead[]): Promise<ExportResult> {
  const res = await fetch('/api/export-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: leads.map(aDTO) }),
  })

  if (!res.ok) {
    let mensaje = `Error ${res.status} exportando a Google Sheets`
    try {
      const data = await res.json()
      if (data?.error) mensaje = data.error
    } catch {
      if (res.status === 404) {
        mensaje = 'El endpoint /api/export-sheets no está disponible. Despliega en Vercel y configura las credenciales de Google (ver GOOGLE_SETUP.md).'
      }
    }
    throw new Error(mensaje)
  }

  return (await res.json()) as ExportResult
}
