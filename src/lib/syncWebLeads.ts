import { supabase } from './supabaseClient'

const SECTOR_MAP: Record<string, string> = {
  restaurante: 'Restaurante',
  clinica: 'Clínica',
  clinica_dental: 'Clínica Dental',
  inmobiliaria: 'Inmobiliaria',
  academia: 'Academia',
  taller: 'Taller',
  peluqueria: 'Estética / Belleza',
  estetica: 'Estética / Belleza',
  veterinaria: 'Veterinaria',
  fisioterapia: 'Fisioterapia',
  gimnasio: 'Gimnasio',
  otro: 'Otro',
}

function getMRR(perdida: number): number {
  if (perdida > 5000) return 390
  if (perdida > 2000) return 290
  if (perdida > 1000) return 190
  return 90
}

function getScore(perdida: number): number {
  if (perdida > 5000) return 10
  if (perdida > 2000) return 9
  if (perdida > 1000) return 8
  return 7
}

export async function syncWebLeads(): Promise<{
  nuevos: number
  yaExistian: number
  errores: number
}> {
  try {
    // 1. IDs ya sincronizados + IDs descartados manualmente
    const [{ data: yaSync }, { data: descartados }] = await Promise.all([
      supabase.from('leads_os').select('quiz_lead_id').not('quiz_lead_id', 'is', null),
      supabase.from('quiz_leads_descartados').select('quiz_lead_id'),
    ])

    const idsYaSync = new Set(
      (yaSync || []).map((r) => r.quiz_lead_id).filter(Boolean)
    )
    const idsDescartados = new Set(
      (descartados || []).map((r) => r.quiz_lead_id).filter(Boolean)
    )

    // 2. Obtener todos los quiz_leads
    const { data: webLeads, error } = await supabase
      .from('quiz_leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!webLeads || webLeads.length === 0) {
      return { nuevos: 0, yaExistian: idsYaSync.size, errores: 0 }
    }

    // 3. Filtrar los no sincronizados ni descartados
    const sinSync = webLeads.filter((l) => !idsYaSync.has(l.id) && !idsDescartados.has(l.id))

    if (sinSync.length === 0) {
      return { nuevos: 0, yaExistian: idsYaSync.size, errores: 0 }
    }

    // 4. Convertir al formato leads_os
    const leadsParaInsertar = sinSync.map((ql) => {
      const perdida = ql.perdida_mensual || 0
      const sector = SECTOR_MAP[ql.tipo_negocio?.toLowerCase()] || 'Otro'
      const score = getScore(perdida)
      const mrr = getMRR(perdida)

      return {
        // Datos de contacto (lo que tenemos del quiz)
        nombre: ql.nombre || 'Lead sin nombre',
        email: ql.email || null,
        telefono: ql.telefono || null,
        sector,

        // Origen y trazabilidad
        fuente: 'web_calculadora',
        quiz_lead_id: ql.id,
        tag: 'Lead Web',

        // Pérdida real calculada por el cliente
        perdida_mensual_real: perdida,
        perdida_anual_real: perdida ? perdida * 12 : null,

        // Score automático — ya están cualificados
        score_cualificacion: score,
        motivo_score: `Lead web: calculó pérdida de ${perdida.toLocaleString('es-ES')}€/mes en wiaresolution.com`,
        volumen_llamadas: perdida > 2000 ? 'muy_alto' : perdida > 1000 ? 'alto' : 'medio',

        // MRR y fase
        mrr_estimado: mrr,
        fase: 'nuevo',

        // Sin datos de Maps (no existen para estos leads)
        direccion: null,
        ciudad: null,
        google_maps_url: null,
        google_place_id: null,
        valoracion: null,
        num_resenas: null,

        // Meta
        creado_por: 'web_automatico',
        created_at: ql.created_at,
      }
    })

    // 5. Insertar en leads_os
    const { error: insertError } = await supabase
      .from('leads_os')
      .insert(leadsParaInsertar)

    if (insertError) throw insertError

    return {
      nuevos: leadsParaInsertar.length,
      yaExistian: idsYaSync.size,
      errores: 0,
    }
  } catch (err) {
    console.error('syncWebLeads error:', err)
    return { nuevos: 0, yaExistian: 0, errores: 1 }
  }
}
