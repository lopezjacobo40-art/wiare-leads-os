import type { VercelRequest, VercelResponse } from '@vercel/node'

/* ─────────────────────────────────────────────
   Vercel Function: busca el email de contacto de un negocio.
   Cascada:
     1. Scraping HTML de su web (regex sobre el body, timeout 6s)
     2. Patrón por dominio (info@, hola@, contacto@, reservas@)
     3. Descripción de Google Maps (regex sobre el texto)
   Devuelve { email, fuente, verificado }.
   Solo funciona en producción (Vercel), no en npm run dev.
   ───────────────────────────────────────────── */

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Dominios de email genéricos que ignoramos (no son del negocio)
const DOMINIOS_IGNORAR = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'me.com', 'live.com', 'msn.com',
  'example.com', 'sentry.io', 'wixpress.com', 'squarespace.com',
]

function limpiarEmails(textos: string[]): string[] {
  return [...new Set(textos)].filter((e) => {
    const dominio = e.split('@')[1]?.toLowerCase() ?? ''
    return !DOMINIOS_IGNORAR.some((d) => dominio.includes(d))
  })
}

async function scrapingWeb(web: string): Promise<string | null> {
  try {
    const url = web.startsWith('http') ? web : `https://${web}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WIARE-bot/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    const matches = html.match(EMAIL_REGEX) ?? []
    const limpios = limpiarEmails(matches)
    // Preferir emails con palabras clave de contacto
    const prioritarios = limpios.filter((e) =>
      /info|hola|contacto|contact|reservas|citas|admin|hello/.test(e.split('@')[0])
    )
    return prioritarios[0] ?? limpios[0] ?? null
  } catch {
    return null
  }
}

function patronDominio(web: string): string | null {
  try {
    const url = web.startsWith('http') ? web : `https://${web}`
    const dominio = new URL(url).hostname.replace(/^www\./, '')
    if (!dominio || dominio.length < 3) return null
    return `info@${dominio}`
  } catch {
    return null
  }
}

function emailEnDescripcion(descripcion: string): string | null {
  const matches = descripcion.match(EMAIL_REGEX) ?? []
  const limpios = limpiarEmails(matches)
  return limpios[0] ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { web, nombre: _nombre, descripcion } = req.body as {
    web?: string
    nombre?: string
    descripcion?: string
  }

  // 1. Scraping web
  if (web) {
    const email = await scrapingWeb(web)
    if (email) {
      return res.json({ email, fuente: 'web_scraping', verificado: false })
    }
  }

  // 2. Patrón dominio
  if (web) {
    const email = patronDominio(web)
    if (email) {
      return res.json({ email, fuente: 'patron_dominio', verificado: false })
    }
  }

  // 3. Descripción Google Maps
  if (descripcion) {
    const email = emailEnDescripcion(descripcion)
    if (email) {
      return res.json({ email, fuente: 'maps_descripcion', verificado: false })
    }
  }

  return res.json({ email: null, fuente: 'no_encontrado', verificado: false })
}
