import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/* Endpoint PÚBLICO para la página de demo /d/:id (el prospecto no tiene sesión).
   Devuelve solo nombre + audio del lead y registra la telemetría server-side,
   sin exponer acceso directo a la base de datos. */

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = typeof req.query.id === 'string' ? req.query.id : null
  if (!id) {
    return res.status(400).json({ error: 'Missing lead id' })
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase config on server' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: lead, error } = await supabase
      .from('leads_os')
      .select('nombre, demo_audio_url')
      .eq('id', id)
      .single()

    if (error || !lead || !lead.demo_audio_url) {
      return res.status(404).json({ error: 'Demo no disponible' })
    }

    // Telemetría (Radar) — si falla no rompe la experiencia del prospecto
    await supabase
      .from('telemetria_os')
      .insert({ lead_id: id, evento: 'demo_escuchada' })
      .then(({ error: telError }) => {
        if (telError) console.error('Error registrando telemetría:', telError.message)
      })

    return res.status(200).json({ nombre: lead.nombre, demo_audio_url: lead.demo_audio_url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
