import type { VercelRequest, VercelResponse } from '@vercel/node'

/* Proxy de media del CDN de Instagram (imágenes y vídeo de posts públicos).
   El CDN bloquea hotlinking según referrer/headers, por lo que las miniaturas
   fallaban de forma intermitente en <img>/<video>. Este proxy las sirve
   siempre. Solo admite hosts del CDN de Instagram/Facebook (no es un proxy
   abierto) y soporta Range para el seeking de vídeo. */

const HOSTS_PERMITIDOS = /(\.cdninstagram\.com|\.fbcdn\.net)$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = typeof req.query.url === 'string' ? req.query.url : ''
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }
  if (target.protocol !== 'https:' || !HOSTS_PERMITIDOS.test(target.hostname)) {
    return res.status(400).json({ error: 'Host no permitido' })
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
    if (typeof req.headers.range === 'string') headers.Range = req.headers.range

    const upstream = await fetch(target.toString(), { headers })
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `CDN respondió ${upstream.status} (la URL puede haber caducado — refresca el competidor)` })
    }

    res.status(upstream.status)
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h)
      if (v) res.setHeader(h, v)
    }
    // Las URLs del CDN llevan firma con caducidad: cachear 1 día es seguro
    res.setHeader('cache-control', 'public, max-age=86400, immutable')

    if (!upstream.body) return res.end()
    const reader = upstream.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    return res.end()
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Error obteniendo el media' })
  }
}
