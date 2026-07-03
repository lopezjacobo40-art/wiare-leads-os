import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const apiKey = process.env.RETELL_API_KEY || process.env.VITE_RETELL_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Retell API Key on server' })
  }

  const { endpoint, payload } = req.body

  if (!endpoint || !payload) {
    return res.status(400).json({ error: 'Missing endpoint or payload' })
  }

  try {
    const retellRes = await fetch(`https://api.retellai.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const data = await retellRes.json()

    if (!retellRes.ok) {
      return res.status(retellRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
