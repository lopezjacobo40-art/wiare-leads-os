import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const { provider, voiceId, customApiKey, azureRegion, ssml, jsonPayload } = req.body

  if (!provider || !voiceId) {
    return res.status(400).json({ error: 'Missing provider or voiceId' })
  }

  try {
    if (provider === 'azure') {
      const apiKey = customApiKey || process.env.AZURE_API_KEY || process.env.VITE_AZURE_API_KEY
      const region = azureRegion || process.env.AZURE_REGION || process.env.VITE_AZURE_REGION || 'westeurope'

      if (!apiKey) {
        return res.status(500).json({ error: 'Missing Azure API Key' })
      }

      const azureRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          'User-Agent': 'wiare-leads-os'
        },
        body: ssml
      })

      if (!azureRes.ok) {
        const text = await azureRes.text()
        return res.status(azureRes.status).json({ error: text })
      }

      const arrayBuffer = await azureRes.arrayBuffer()
      res.setHeader('Content-Type', 'audio/mpeg')
      return res.status(200).send(Buffer.from(arrayBuffer))
    } 
    else if (provider === 'elevenlabs') {
      const apiKey = customApiKey || process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY

      if (!apiKey) {
        return res.status(500).json({ error: 'Missing ElevenLabs API Key' })
      }

      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify(jsonPayload)
      })

      if (!elRes.ok) {
        const text = await elRes.text()
        return res.status(elRes.status).json({ error: text })
      }

      const arrayBuffer = await elRes.arrayBuffer()
      res.setHeader('Content-Type', 'audio/mpeg')
      return res.status(200).send(Buffer.from(arrayBuffer))
    }
    
    return res.status(400).json({ error: 'Invalid provider' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' })
  }
}
