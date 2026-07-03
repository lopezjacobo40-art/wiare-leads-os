import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Anthropic API Key on server' })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body)
    })

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
