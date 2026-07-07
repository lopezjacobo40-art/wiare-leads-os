import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_lib/verifyAuth.js'
import { scrapeCompetidorServer } from './_lib/igScrape.js'

/* GET = cron diario de competidores (Vercel Cron manda Authorization: Bearer
   CRON_SECRET). Refresca los 3 con el scrape más antiguo — la rotación cubre
   todos en pocos días. Vive aquí por el límite de 12 funciones del plan Hobby. */
async function handleCronCompetidores(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const apifyToken = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apifyToken || !supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Faltan envs (Apify/Supabase) en el servidor' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: comps, error } = await supabase
    .from('competitors_os')
    .select('id, username')
    .eq('activo', true)
    .order('ultimo_scrape', { ascending: true, nullsFirst: true })
    .limit(3)
  if (error) return res.status(500).json({ error: error.message })

  const resultados = []
  for (const comp of comps ?? []) {
    resultados.push(await scrapeCompetidorServer(supabase, apifyToken, comp))
  }
  console.log('cron competidores:', JSON.stringify(resultados))
  return res.status(200).json({ refrescados: resultados })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleCronCompetidores(req, res)
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const apiKey = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Apify API Key on server' })
  }

  const { targetMethod, endpoint, payload } = req.body

  if (!targetMethod || !endpoint) {
    return res.status(400).json({ error: 'Missing targetMethod or endpoint' })
  }

  try {
    // Apify URLs usually look like /acts/compass~crawler-google-places/runs
    // we just append ?token=... or &token=...
    const separator = endpoint.includes('?') ? '&' : '?'
    const apifyUrl = `https://api.apify.com/v2${endpoint}${separator}token=${apiKey}`

    const options: RequestInit = {
      method: targetMethod,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (payload && targetMethod !== 'GET' && targetMethod !== 'HEAD') {
      options.body = JSON.stringify(payload)
    }

    const apifyRes = await fetch(apifyUrl, options)
    const data = await apifyRes.json()

    if (!apifyRes.ok) {
      return res.status(apifyRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' })
  }
}
