import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)
const APIFY_API_KEY = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY
const APIFY_BASE = 'https://api.apify.com/v2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Apify Webhook payload
  const { eventType, resource } = req.body

  if (!resource || !resource.id) {
    return res.status(400).json({ error: 'Missing resource ID' })
  }

  const runId = resource.id
  const status = resource.status // SUCCEEDED, FAILED, etc.
  const datasetId = resource.defaultDatasetId

  try {
    // 1. Buscar la extracción en Supabase para obtener contexto (sector, ciudad, extraccion_id)
    const { data: extraccion, error: extError } = await supabase
      .from('extracciones_os')
      .select('*')
      .eq('run_id', runId)
      .single()

    if (extError || !extraccion) {
      console.error(`Extracción no encontrada para run_id: ${runId}`)
      return res.status(404).json({ error: 'Extracción no encontrada' })
    }

    if (status !== 'SUCCEEDED') {
      await supabase
        .from('extracciones_os')
        .update({ estado: 'error' })
        .eq('id', extraccion.id)
      return res.status(200).json({ message: 'Run failed, status updated' })
    }

    // 2. Descargar el dataset de Apify
    const datasetRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_API_KEY}&format=json`
    )

    if (!datasetRes.ok) {
      throw new Error('Error descargando dataset de Apify')
    }

    const items = await datasetRes.json()

    // 3. Mapear y procesar (filtrado básico de duplicados si se quiere, o insertar todo)
    // Extraemos la lógica de apifyClient para limpiar
    const leadsParaInsertar = items.map((item: any) => ({
      nombre: String(item.title || item.name || ''),
      sector: extraccion.sector,
      telefono: item.phone || item.phoneUnformatted || null,
      email: item.email || null,
      email_fuente: item.email ? 'apify_maps' : null,
      email_verificado: false,
      web: item.website || null,
      google_maps_url: item.url || null,
      google_place_id: item.placeId || null,
      valoracion: item.totalScore || item.rating || null,
      num_resenas: item.reviewsCount || item.userRatingsTotal || null,
      direccion: item.address || item.street || null,
      ciudad: extraccion.ciudad,
      horario: item.openingHours ? (Array.isArray(item.openingHours) ? item.openingHours : [item.openingHours]) : null,
      descripcion: item.description || item.editorialSummary || null,
      fuente: 'extraccion',
      fase: 'nuevo',
      creado_por: 'webhook',
      extraccion_id: extraccion.extraccion_id,
      extraccion_fecha: new Date().toISOString(),
    }))

    // 4. Filtrar duplicados existentes en DB
    const placeIds = leadsParaInsertar.map((l: any) => l.google_place_id).filter(Boolean)
    const { data: existentes } = await supabase
      .from('leads_os')
      .select('google_place_id')
      .in('google_place_id', placeIds)

    const yaExisten = new Set((existentes ?? []).map((e: any) => e.google_place_id))
    const nuevos = leadsParaInsertar.filter((l: any) => !yaExisten.has(l.google_place_id))

    // 5. Insertar en leads_os
    if (nuevos.length > 0) {
      const { error: insError } = await supabase
        .from('leads_os')
        .insert(nuevos)
      
      if (insError) throw insError
    }

    // 6. Actualizar estado de extracción
    await supabase
      .from('extracciones_os')
      .update({ 
        estado: 'completada', 
        total_leads: nuevos.length 
      })
      .eq('id', extraccion.id)

    return res.status(200).json({ message: 'Extracción completada', insertados: nuevos.length })

  } catch (error: any) {
    console.error('Error en webhook Apify:', error)
    return res.status(500).json({ error: error.message })
  }
}
