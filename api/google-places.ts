import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Google Places API Key on server' })
  }

  const { fieldMask, payload } = req.body

  if (!fieldMask || !payload) {
    return res.status(400).json({ error: 'Missing fieldMask or payload' })
  }

  try {
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(payload)
    })

    const data = await placesRes.json()

    if (!placesRes.ok) {
      return res.status(placesRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' })
  }
}
