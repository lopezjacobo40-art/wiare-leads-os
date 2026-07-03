import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Gemini API Key on server' })
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    })

    const data = await geminiRes.json()

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
