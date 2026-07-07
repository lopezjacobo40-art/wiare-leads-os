import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/verifyAuth.js'

/* Consolidador de noticias: agrega los RSS de Google News (sin API key)
   para los temas del sector de WIARE y devuelve una lista unificada,
   deduplicada y ordenada por fecha.

   Con ?media=<url> actúa como proxy del CDN de Instagram (imágenes y vídeo
   de posts públicos de competidores): el CDN bloquea hotlinking de forma
   intermitente. Vive aquí y no en su propio archivo porque el plan Hobby
   de Vercel limita a 12 funciones serverless y esta era la 13ª. */

const HOSTS_MEDIA = /(\.cdninstagram\.com|\.fbcdn\.net)$/i

async function proxyMedia(req: VercelRequest, res: VercelResponse, url: string) {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }
  if (target.protocol !== 'https:' || !HOSTS_MEDIA.test(target.hostname)) {
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

const TEMAS: { id: string; label: string; query: string }[] = [
  { id: 'ia_voz', label: 'IA de voz', query: 'agentes de voz inteligencia artificial atención telefónica' },
  { id: 'ia_soluciones', label: 'Soluciones IA', query: 'inteligencia artificial soluciones negocios locales atención al cliente' },
  { id: 'automatizacion', label: 'Automatización', query: 'automatización IA pymes citas reservas whatsapp' },
  { id: 'ia_negocio', label: 'IA y pymes', query: 'inteligencia artificial pymes España adopción herramientas' },
  { id: 'clinicas', label: 'Clínicas', query: 'clínicas dentales digitalización pacientes España' },
  { id: 'hosteleria', label: 'Hostelería', query: 'restaurantes reservas tecnología hostelería España' },
]

interface Noticia {
  tema: string
  titulo: string
  url: string
  fuente: string
  fecha: string | null
}

function limpiar(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .trim()
}

function parseRss(xml: string, tema: string): Noticia[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  return items.map((item) => {
    const titulo = limpiar(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const url = limpiar(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const fuente = limpiar(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')
    const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]
    const fecha = pub ? new Date(pub).toISOString() : null
    return { tema, titulo, url, fuente, fecha }
  }).filter((n) => n.titulo && n.url)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Modo proxy de media (los <img>/<video> no pueden mandar Authorization;
  // solo sirve contenido público del CDN de IG con host validado)
  if (typeof req.query.media === 'string') {
    return proxyMedia(req, res, req.query.media)
  }

  if (!(await requireAuth(req, res))) return

  try {
    const porTema = await Promise.all(
      TEMAS.map(async (t) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(t.query)}&hl=es&gl=ES&ceid=ES:es`
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WiareOS/1.0)' } })
          if (!r.ok) return []
          return parseRss(await r.text(), t.id).slice(0, 12)
        } catch {
          return []
        }
      })
    )

    // Unificar + dedupe por título normalizado + ordenar por fecha desc
    const vistas = new Set<string>()
    const noticias = porTema
      .flat()
      .filter((n) => {
        const clave = n.titulo.toLowerCase().replace(/\W+/g, ' ').trim()
        if (vistas.has(clave)) return false
        vistas.add(clave)
        return true
      })
      .sort((a, b) => new Date(b.fecha ?? 0).getTime() - new Date(a.fecha ?? 0).getTime())

    return res.status(200).json({
      temas: TEMAS.map(({ id, label }) => ({ id, label })),
      noticias,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error agregando noticias' })
  }
}
