import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
