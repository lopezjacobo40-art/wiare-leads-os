import type { VercelRequest, VercelResponse } from '@vercel/node'

/* ─────────────────────────────────────────────
   Vercel Function: busca email de contacto real de un negocio.

   Cascada (en orden, para en cuanto encuentra algo válido):
     1. Descripción de Google Maps (texto en claro, sin petición extra)
     2. Apify website-content-crawler sobre la web del negocio
        (hasta 5 páginas: home + rutas de contacto)
     3. Scraping directo con fetch + regex (rápido, sin coste Apify)
     4. Patrón dominio — info@dominio.com (último recurso real)

   Filtra: emails genéricos, de plataformas, no relacionados con el dominio.
   Prioriza: prefijos de contacto (info@, hola@, contacto@…)
   ───────────────────────────────────────────── */

const APIFY_BASE = 'https://api.apify.com/v2'
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

const DOMINIOS_IGNORAR = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'me.com', 'live.com', 'msn.com', 'example.com',
  'sentry.io', 'wixpress.com', 'squarespace.com', 'wordpress.com',
  'wix.com', 'godaddy.com', 'ionos.es', 'arsys.es', 'dinahosting.com',
  'mailchimp.com', 'mailerlite.com', 'sendgrid.net', 'google.com',
  'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
]

const PREFIJOS_CONTACTO = [
  'info', 'hola', 'contacto', 'contact', 'reservas', 'citas',
  'recepcion', 'admin', 'hello', 'clínica', 'clinica', 'dental',
  'consultas', 'atencion', 'atención', 'servicios',
]

function extraerEmails(texto: string): string[] {
  const matches = texto.match(EMAIL_REGEX) ?? []
  return [...new Set(matches)].filter((e) => {
    const dominio = e.split('@')[1]?.toLowerCase() ?? ''
    return !DOMINIOS_IGNORAR.some((d) => dominio === d || dominio.endsWith('.' + d))
  })
}

function priorizarEmails(emails: string[], dominio: string): string | null {
  if (emails.length === 0) return null

  // 1º: mismo dominio con prefijo de contacto
  const mismoConPrefijo = emails.find((e) => {
    const [local, dom] = e.toLowerCase().split('@')
    return dom?.includes(dominio) && PREFIJOS_CONTACTO.some((p) => local.startsWith(p))
  })
  if (mismoConPrefijo) return mismoConPrefijo

  // 2º: mismo dominio (cualquier prefijo)
  const mismoDominio = emails.find((e) => e.toLowerCase().split('@')[1]?.includes(dominio))
  if (mismoDominio) return mismoDominio

  // 3º: prefijo de contacto aunque no sea el mismo dominio
  const conPrefijo = emails.find((e) =>
    PREFIJOS_CONTACTO.some((p) => e.toLowerCase().split('@')[0].startsWith(p))
  )
  if (conPrefijo) return conPrefijo

  return emails[0]
}

function getDominio(web: string): string {
  try {
    const url = web.startsWith('http') ? web : `https://${web}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ── 1. Descripción de Google Maps ──────────────────────────────
function emailDeDescripcion(descripcion: string | null, dominio: string): string | null {
  if (!descripcion) return null
  return priorizarEmails(extraerEmails(descripcion), dominio)
}

// ── 2. Apify website-content-crawler ──────────────────────────
async function emailConApify(web: string, dominio: string): Promise<string | null> {
  const apiKey = process.env.APIFY_API_KEY ?? process.env.VITE_APIFY_API_KEY
  if (!apiKey) return null

  const baseUrl = web.startsWith('http') ? web.replace(/\/$/, '') : `https://${web.replace(/\/$/, '')}`

  // URLs a crawlear: home + rutas de contacto habituales en ES
  const startUrls = [
    baseUrl,
    `${baseUrl}/contacto`,
    `${baseUrl}/contact`,
    `${baseUrl}/sobre-nosotros`,
    `${baseUrl}/quienes-somos`,
  ].map((url) => ({ url }))

  try {
    const runRes = await fetch(
      `${APIFY_BASE}/acts/apify~website-content-crawler/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          maxCrawlPages: 5,
          maxCrawlDepth: 0,       // Solo las páginas indicadas, sin seguir links
          crawlerType: 'cheerio', // Más rápido que headless, suficiente para extraer emails
          saveHtml: false,
          saveMarkdown: false,
        }),
      }
    )
    if (!runRes.ok) return null

    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) return null

    // Polling máx 40s (8 × 5s) — dentro del límite de la Vercel Function
    let status = 'RUNNING'
    let intentos = 0
    while ((status === 'RUNNING' || status === 'READY') && intentos < 8) {
      await new Promise((r) => setTimeout(r, 5000))
      intentos++
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
      if (!statusRes.ok) break
      status = (await statusRes.json()).data?.status ?? 'FAILED'
    }

    if (status !== 'SUCCEEDED') return null

    const dataRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apiKey}&fields=text,url`
    )
    if (!dataRes.ok) return null

    const items: { text?: string; url?: string }[] = await dataRes.json()

    // Recoger todos los emails de todas las páginas y priorizar
    const todosEmails: string[] = []
    for (const item of items) {
      todosEmails.push(...extraerEmails(item.text ?? ''))
    }
    return priorizarEmails([...new Set(todosEmails)], dominio)
  } catch {
    return null
  }
}

// ── 3. Scraping directo ────────────────────────────────────────
async function emailConScraping(web: string, dominio: string): Promise<string | null> {
  const baseUrl = web.startsWith('http') ? web.replace(/\/$/, '') : `https://${web.replace(/\/$/, '')}`
  const urls = [baseUrl, `${baseUrl}/contacto`, `${baseUrl}/contact`]
  const todosEmails: string[] = []

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WIARE-bot/1.0)' },
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const html = await res.text()
      // También buscar en atributos data-* y href="mailto:..."
      const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g)]
        .map((m) => m[1])
      todosEmails.push(...extraerEmails(html), ...mailtoMatches)
    } catch {
      continue
    }
  }

  return priorizarEmails([...new Set(todosEmails)], dominio)
}

// ── 4. Búsqueda LinkedIn X-Ray (Apify Google Search) ──
async function buscarDecisorLinkedIn(nombreEmpresa: string, web: string): Promise<{ nombre: string, cargo: string, linkedin: string, emailPredictivo: string | null } | null> {
  const apiKey = process.env.APIFY_API_KEY ?? process.env.VITE_APIFY_API_KEY
  if (!apiKey || !nombreEmpresa) return null

  try {
    const query = `site:linkedin.com/in "Fundador" OR "Propietario" OR "CEO" OR "Founder" OR "Owner" "${nombreEmpresa}"`
    const runRes = await fetch(
      `${APIFY_BASE}/acts/apify~google-search-scraper/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: query,
          maxPagesPerQuery: 1,
          resultsPerPage: 1,
          countryCode: "es",
        }),
      }
    )
    if (!runRes.ok) return null
    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) return null

    let status = 'RUNNING'
    let intentos = 0
    while ((status === 'RUNNING' || status === 'READY') && intentos < 8) {
      await new Promise(r => setTimeout(r, 4000))
      intentos++
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
      if (!statusRes.ok) break
      status = (await statusRes.json()).data?.status ?? 'FAILED'
    }

    if (status !== 'SUCCEEDED') return null

    const dataRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apiKey}`)
    if (!dataRes.ok) return null
    const items = await dataRes.json()
    
    if (!items || items.length === 0 || !items[0].organicResults || items[0].organicResults.length === 0) return null

    const primerResultado = items[0].organicResults[0]
    const url = primerResultado.url
    const title = primerResultado.title // Ej: "Juan Pérez - Fundador - Clínica..."

    const partes = title.split('-').map((p: string) => p.trim())
    const nombreDecisor = partes[0]
    let cargoDecisor = partes.length > 1 ? partes[1] : 'Dueño/a'
    
    if (nombreDecisor.toLowerCase().includes(nombreEmpresa.toLowerCase())) return null

    let emailPredictivo = null
    const dominio = getDominio(web)
    if (dominio && nombreDecisor) {
      const nombreLimpio = nombreDecisor.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
      emailPredictivo = `${nombreLimpio}@${dominio}`
    }

    return {
      nombre: nombreDecisor,
      cargo: cargoDecisor,
      linkedin: url,
      emailPredictivo
    }
  } catch {
    return null
  }
}

// ── Handler principal ──────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { web, descripcion, nombre } = req.body as {
    web?: string
    descripcion?: string
    nombre?: string
  }

  const dominio = web ? getDominio(web) : ''

  // Lanzamos la búsqueda de LinkedIn en paralelo para no bloquear el scraping rápido
  const promesaLinkedIn = (nombre && web) ? buscarDecisorLinkedIn(nombre, web) : Promise.resolve(null)

  let finalEmail: string | null = null
  let finalFuente = 'sin_email'

  // 1. Descripción Maps (gratis, instantáneo)
  if (descripcion) {
    const email = emailDeDescripcion(descripcion, dominio)
    if (email) { finalEmail = email; finalFuente = 'maps_descripcion' }
  }

  // 2. Scraping directo (GRATIS y muy rápido ~1-3s)
  if (!finalEmail && web) {
    const emailScraping = await emailConScraping(web, dominio)
    if (emailScraping) { finalEmail = emailScraping; finalFuente = 'web_scraping' }
  }

  // 3. Apify crawler (mejor calidad pero cuesta dinero y tarda ~30s)
  if (!finalEmail && web) {
    const emailApify = await emailConApify(web, dominio)
    if (emailApify) { finalEmail = emailApify; finalFuente = 'apify_crawler' }
  }

  // Esperamos a que termine LinkedIn (si no ha terminado ya)
  const decisorInfo = await promesaLinkedIn

  // Si tenemos un email predictivo del CEO, preferimos usar ese antes que un info@ genérico
  if (decisorInfo?.emailPredictivo) {
    if (!finalEmail || PREFIJOS_CONTACTO.some(p => finalEmail?.startsWith(p))) {
      finalEmail = decisorInfo.emailPredictivo
      finalFuente = 'linkedin_predictivo'
    }
  }

  return res.json({ 
    email: finalEmail, 
    fuente: finalFuente, 
    verificado: false,
    decisor: decisorInfo 
  })
}
