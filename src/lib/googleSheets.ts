import type { Lead } from './supabaseClient'

/* ─────────────────────────────────────────────
   Cliente de exportación a Google Sheets.
   La lógica real (OAuth2 + Sheets API) vive en la API route
   serverless /api/export-sheets — aquí solo enviamos los leads
   y devolvemos la URL del sheet creado/actualizado.
   ───────────────────────────────────────────── */

// Campos que el endpoint necesita de cada lead (subconjunto del nuevo funnel v6).
function aDTO(lead: Lead) {
  return {
    id: lead.id,
    created_at: lead.created_at,
    nombre: lead.nombre,
    sector: lead.sector,
    ciudad: lead.ciudad,
    telefono: lead.telefono,
    email: lead.email,
    web: lead.web,
    score_cualificacion: lead.score_cualificacion,
    fase: lead.fase,
    ahorro_estimado: lead.analisis_brechas?.ahorro_estimado ?? null,
    resumen: lead.motivo_score,
    analizado_at: lead.analizado_at,
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
