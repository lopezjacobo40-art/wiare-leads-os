const APIFY_API_KEY = import.meta.env.VITE_APIFY_API_KEY
const ACTOR_ID = 'compass~crawler-google-places'
const APIFY_BASE = 'https://api.apify.com/v2'

import { fetchWithAudit } from './apiAuditor'

export interface ApifyLead {
  title: string
  phone: string | null
  email: string | null
  website: string | null
  rating: number | null
  reviewsCount: number | null
  address: string | null
  city: string | null
  url: string | null
  placeId: string | null
  openingHours: string[]
  description: string | null
}

const EMAIL_PRIORITY_PREFIXES = ['contact', 'info', 'hello', 'hola', 'reservas', 'citas', 'recepcion', 'admin']

function extractEmailFromText(text: string | null): string | null {
  if (!text) return null
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
  if (!matches) return null
  // Priorizar emails de contacto del negocio sobre emails de terceros
  const prioritized = matches.find((e) =>
    EMAIL_PRIORITY_PREFIXES.some((p) => e.toLowerCase().startsWith(p))
  )
  return prioritized ?? matches[0]
}

function normalizeOpeningHours(raw: unknown): string[] {
  if (!raw) return []
  if (typeof raw === 'string') return [raw]
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        // { day: "Lunes", hours: "13:00-16:00, 20:00-00:00" }
        if (o.day && o.hours) return `${o.day}: ${o.hours}`
        // { day: "Lunes", opens: "13:00", closes: "16:00" }
        if (o.day && o.opens) return `${o.day}: ${o.opens}-${o.closes ?? ''}`
        // { dayOfWeek: "Monday", opens: "09:00", closes: "22:00" }
        if (o.dayOfWeek && o.opens) return `${o.dayOfWeek}: ${o.opens}-${o.closes ?? ''}`
        // Cualquier otro objeto: serializar sus valores
        return Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ')
      }
      return String(item)
    }).filter(Boolean)
  }
  if (typeof raw === 'object') {
    // { "Monday": "9:00-18:00", ... }
    return Object.entries(raw as Record<string, string>).map(([day, hours]) => `${day}: ${hours}`)
  }
  return []
}

export async function extraerLeadsConApifyAsync(
  sector: string,
  ciudad: string,
  cantidad: number
): Promise<{ runId: string, modo: 'async' | 'sync' }> {
  // Ahora forzamos siempre 'sync' para que el usuario vea el progreso en vivo (polling en el frontend)
  const isLocalhost = true 
  
  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/apify-maps`
  
  const webhooks = [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED', 'ACTOR.RUN.TIMED_OUT'],
      requestUrl: webhookUrl
    }
  ]
  const webhooksBase64 = typeof btoa !== 'undefined' ? btoa(JSON.stringify(webhooks)) : ''
  const url = isLocalhost 
    ? `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_API_KEY}`
    : `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_API_KEY}&webhooks=${webhooksBase64}`

  const runRes = await fetchWithAudit(url, {
      method: 'POST',
      service: 'Apify',
      retries: 3,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [`${sector} en ${ciudad}`],
        maxCrawledPlacesPerSearch: cantidad,
        language: 'es',
        countryCode: 'es',
        includeWebResults: false,
        scrapeDirectories: false,
        deeperCityScrape: false,
        scrapeTabletsDesktop: false,
        maxImages: 0,
        maxReviews: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        reviewsSort: 'newest',
        reviewsFilterString: '',
      }),
    }
  )

  if (!runRes.ok) {
    const err = await runRes.text()
    throw new Error(`Error lanzando Apify: ${err}`)
  }

  const runData = await runRes.json()
  return { runId: runData.data.id, modo: 'sync' }
}

export async function extraerLeadsConApify(
  sector: string,
  ciudad: string,
  cantidad: number,
  onProgress?: (mensaje: string) => void,
  existingRunId?: string
): Promise<ApifyLead[]> {
  onProgress?.(`Iniciando extracción de ${sector} en ${ciudad}...`)

  let runId = existingRunId
  if (!runId) {
    // 1. Lanzar el actor (modo síncrono clásico)
    const runRes = await fetchWithAudit(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        service: 'Apify',
        retries: 3,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [`${sector} en ${ciudad}`],
          maxCrawledPlacesPerSearch: cantidad,
          language: 'es',
          countryCode: 'es',
          includeWebResults: false,
          scrapeDirectories: false,
          deeperCityScrape: false,
          scrapeTabletsDesktop: false,
          maxImages: 0,
          maxReviews: 0,
          exportPlaceUrls: false,
          additionalInfo: false,
          reviewsSort: 'newest',
          reviewsFilterString: '',
        }),
      }
    )

  if (!runRes.ok) {
    const err = await runRes.text()
    throw new Error(`Error lanzando Apify: ${err}`)
  }

    const runData = await runRes.json()
    runId = runData.data.id
  }

  onProgress?.('Apify procesando... esto tarda 1-2 minutos')

  // 2. Polling hasta que termine
  let status = 'RUNNING'
  let intentos = 0
  const maxIntentos = 30 // 2.5 minutos máximo

  while (status === 'RUNNING' || status === 'READY') {
    await new Promise(r => setTimeout(r, 5000))
    intentos++

    const statusRes = await fetchWithAudit(
      `${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_KEY}`,
      { service: 'Apify' }
    )
    const statusData = await statusRes.json()
    status = statusData.data.status

    onProgress?.(`Procesando... (${intentos * 5}s) — Estado: ${status}`)

    if (intentos >= maxIntentos) {
      throw new Error('Apify tardó demasiado — inténtalo de nuevo')
    }
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify falló con estado: ${status}`)
  }

  onProgress?.('Descargando resultados...')

  // 3. Descargar resultados
  const datasetRes = await fetchWithAudit(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_KEY}&format=json&limit=${cantidad}`,
    { service: 'Apify' }
  )

  if (!datasetRes.ok) {
    throw new Error('Error descargando resultados de Apify')
  }

  const items: Record<string, unknown>[] = await datasetRes.json()

  onProgress?.(`✅ ${items.length} negocios extraídos`)

  // 4. Mapear al formato ApifyLead
  return items.map((item) => ({
    title: String(item.title || item.name || ''),
    phone: (item.phone as string) || (item.phoneUnformatted as string) || null,
    email: (item.email as string) || extractEmailFromText(item.description as string) || null,
    website: (item.website as string) || null,
    rating: (item.totalScore as number) || (item.rating as number) || null,
    reviewsCount: (item.reviewsCount as number) || (item.userRatingsTotal as number) || null,
    address: (item.address as string) || (item.street as string) || null,
    city: (item.city as string) || ciudad,
    url: (item.url as string) || null,
    placeId: (item.placeId as string) || null,
    openingHours: normalizeOpeningHours(item.openingHours),
    description: (item.description as string) || (item.editorialSummary as string) || null,
  }))
}

// Lanza un actor de Apify y devuelve los items del dataset, o [] si falla.
// Hace polling hasta SUCCEEDED (máx ~90s). No lanza: cualquier fallo → [].
async function correrActor(actor: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  try {
    const runRes = await fetchWithAudit(`${APIFY_BASE}/acts/${actor}/runs?token=${APIFY_API_KEY}`, {
      method: 'POST',
      service: 'Apify',
      retries: 3,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!runRes.ok) return []
    const runData = await runRes.json()
    const runId = runData.data.id

    let status = 'RUNNING'
    let intentos = 0
    while ((status === 'RUNNING' || status === 'READY') && intentos < 18) {
      await new Promise((r) => setTimeout(r, 5000))
      intentos++
      const statusRes = await fetchWithAudit(
      `${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_KEY}`,
      { service: 'Apify' }
    )
      if (!statusRes.ok) break
      const statusData = await statusRes.json()
      status = statusData.data.status
    }
    if (status !== 'SUCCEEDED') return []

    const dataRes = await fetchWithAudit(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_KEY}`, { service: 'Apify' })
    if (!dataRes.ok) return []
    return await dataRes.json()
  } catch (e) {
    console.warn(`Error en actor Apify ${actor}:`, e)
    return []
  }
}

// Emails a descartar (bots, sistemas, no-personas)
const EMAIL_BLACKLIST = ['noreply', 'no-reply', 'donotreply', 'ejemplo', 'example', 'sentry', 'wordpress', 'wix', 'mailer', 'bounce']

function esEmailValido(email: string): boolean {
  const local = email.split('@')[0].toLowerCase()
  return !EMAIL_BLACKLIST.some((b) => local.includes(b))
}

function extraerEmailReal(texto: string): string | null {
  const email = extractEmailFromText(texto)
  if (!email || !esEmailValido(email)) return null
  return email
}

export interface EmailCascada {
  email: string | null
  fuente: string // 'apify_maps' | 'apify_web' | 'apify_contact' | 'apify_extractor' | 'sin_email'
}

// Cascada de búsqueda de email real: para al primer éxito.
// NUNCA devuelve un patrón info@dominio inventado.
//   1. Email ya presente (del crawler de Maps).
//   2. Email en descripción de Maps (extraído del texto publicado).
//   3. apify~website-content-crawler sobre la web (crawl 3 págs).
//   4. vdrmota~contact-info-scraper (extrae emails/teléfonos/redes de la web).
//   5. apify~web-email-extractor (2º scraper independiente, distinto motor).
//   Si ninguno da email real → { email: null, fuente: 'sin_email' }.
export async function buscarEmailCascada(lead: {
  email?: string | null
  web?: string | null
  descripcion?: string | null
}): Promise<EmailCascada> {
  // 1. Ya lo trajo Maps
  if (lead.email && esEmailValido(lead.email)) return { email: lead.email, fuente: 'apify_maps' }

  // 2. Email en la descripción de Maps (publicado por el negocio, gratis)
  const desdeDescripcion = extraerEmailReal(lead.descripcion ?? '')
  if (desdeDescripcion) return { email: desdeDescripcion, fuente: 'apify_maps' }

  if (lead.web) {
    // 3. website-content-crawler
    const itemsWeb = await correrActor('apify~website-content-crawler', {
      startUrls: [{ url: lead.web }],
      maxCrawlPages: 3,
      maxCrawlDepth: 1,
    })
    for (const item of itemsWeb) {
      const email = extraerEmailReal(String(item.text || item.html || item.content || ''))
      if (email) return { email, fuente: 'apify_web' }
    }

    // 4. contact-info-scraper (si el actor no existe en la cuenta → [] y sigue)
    const itemsContact = await correrActor('vdrmota~contact-info-scraper', {
      startUrls: [{ url: lead.web }],
      maxRequestsPerStartUrl: 5,
      maxDepth: 1,
    })
    for (const item of itemsContact) {
      const emails = item.emails as string[] | undefined
      if (Array.isArray(emails) && emails.length > 0) {
        const valido =
          emails.find((e) => esEmailValido(e) && EMAIL_PRIORITY_PREFIXES.some((p) => e.toLowerCase().startsWith(p))) ??
          emails.find((e) => esEmailValido(e))
        if (valido) return { email: valido, fuente: 'apify_contact' }
      }
      const email = extraerEmailReal(String(item.text || item.html || ''))
      if (email) return { email, fuente: 'apify_contact' }
    }

    // 5. web-email-extractor — 2º motor independiente (si falla → sigue)
    const itemsExtractor = await correrActor('apify~web-email-extractor', {
      startUrls: [{ url: lead.web }],
      maxPagesPerCrawl: 5,
    })
    for (const item of itemsExtractor) {
      const emails = item.emails as string[] | undefined
      if (Array.isArray(emails) && emails.length > 0) {
        const valido =
          emails.find((e) => esEmailValido(e) && EMAIL_PRIORITY_PREFIXES.some((p) => e.toLowerCase().startsWith(p))) ??
          emails.find((e) => esEmailValido(e))
        if (valido) return { email: valido, fuente: 'apify_extractor' }
      }
    }
  }

  return { email: null, fuente: 'sin_email' }
}

// Busca el perfil de LinkedIn del fundador/propietario usando Google Search
export async function buscarDecisorLinkedIn(
  nombreEmpresa: string,
  ciudad: string
): Promise<{ textSnippet: string; url: string } | null> {
  const query = `site:linkedin.com/in ("fundador" OR "founder" OR "propietario" OR "ceo" OR "director" OR "dueño") "${nombreEmpresa}" "${ciudad}"`
  
  const items = await correrActor('apify~google-search-scraper', {
    queries: query,
    resultsPerPage: 3,
    maxPagesPerQuery: 1,
    languageCode: 'es',
    countryCode: 'es',
  })
  
  if (!items || items.length === 0) return null
  
  // apify~google-search-scraper devuelve un array donde el primer item tiene la propiedad 'organicResults'
  const firstItem = items[0]
  const organicResults = firstItem.organicResults as Array<{ title: string; url: string; description: string }>
  
  if (!organicResults || organicResults.length === 0) return null
  
  // Tomar el primer resultado orgánico que sea de LinkedIn
  const result = organicResults.find(r => r.url && r.url.includes('linkedin.com/in/'))
  
  if (!result) return null
  
  return {
    textSnippet: `${result.title} - ${result.description}`,
    url: result.url
  }
}

// Genera permutaciones de correo electrónico basadas en nombre y dominio
export function generarPermutacionesEmail(nombreCompleto: string, dominio: string): string[] {
  if (!nombreCompleto || !dominio) return []
  
  // Limpiar dominio
  let cleanDomain = dominio.toLowerCase().trim()
  if (cleanDomain.startsWith('http')) {
    try {
      const url = new URL(cleanDomain)
      cleanDomain = url.hostname.replace('www.', '')
    } catch (e) {
      // ignorar
    }
  }
  
  // Limpiar nombre (quitar acentos, etc.)
  const cleanName = nombreCompleto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  
  const partes = cleanName.split(/\s+/)
  if (partes.length === 0) return []
  
  const nombre = partes[0]
  const apellido = partes.length > 1 ? partes[partes.length - 1] : ''
  const inicialNombre = nombre.charAt(0)
  
  const permutaciones = new Set<string>()
  
  // Patrones comunes
  permutaciones.add(`${nombre}@${cleanDomain}`)
  if (apellido) {
    permutaciones.add(`${nombre}.${apellido}@${cleanDomain}`)
    permutaciones.add(`${inicialNombre}${apellido}@${cleanDomain}`)
    permutaciones.add(`${nombre}${apellido}@${cleanDomain}`)
    permutaciones.add(`${nombre}_${apellido}@${cleanDomain}`)
    permutaciones.add(`${apellido}@${cleanDomain}`)
    permutaciones.add(`${inicialNombre}.${apellido}@${cleanDomain}`)
  }
  
  return Array.from(permutaciones)
}

