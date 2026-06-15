const APIFY_API_KEY = import.meta.env.VITE_APIFY_API_KEY
const ACTOR_ID = 'compass~crawler-google-places'
const APIFY_BASE = 'https://api.apify.com/v2'

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

export async function extraerLeadsConApify(
  sector: string,
  ciudad: string,
  cantidad: number,
  onProgress?: (mensaje: string) => void
): Promise<ApifyLead[]> {
  onProgress?.(`Iniciando extracción de ${sector} en ${ciudad}...`)

  // 1. Lanzar el actor
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_API_KEY}`,
    {
      method: 'POST',
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
  const runId = runData.data.id

  onProgress?.('Apify procesando... esto tarda 1-2 minutos')

  // 2. Polling hasta que termine
  let status = 'RUNNING'
  let intentos = 0
  const maxIntentos = 30 // 2.5 minutos máximo

  while (status === 'RUNNING' || status === 'READY') {
    await new Promise(r => setTimeout(r, 5000))
    intentos++

    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_KEY}`
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
  const datasetRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_KEY}&format=json&limit=${cantidad}`
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
    const runRes = await fetch(`${APIFY_BASE}/acts/${actor}/runs?token=${APIFY_API_KEY}`, {
      method: 'POST',
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
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_KEY}`)
      if (!statusRes.ok) break
      const statusData = await statusRes.json()
      status = statusData.data.status
    }
    if (status !== 'SUCCEEDED') return []

    const dataRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_KEY}`)
    if (!dataRes.ok) return []
    return await dataRes.json()
  } catch (e) {
    console.warn(`Error en actor Apify ${actor}:`, e)
    return []
  }
}

// Deriva info@{dominio} a partir de una URL de web (último recurso, sin verificar).
function patronDominio(web: string | null): string | null {
  if (!web) return null
  try {
    const host = new URL(web.startsWith('http') ? web : `https://${web}`).hostname.replace(/^www\./, '')
    if (!host.includes('.')) return null
    return `info@${host}`
  } catch {
    return null
  }
}

export interface EmailCascada {
  email: string | null
  fuente: string // 'apify_maps' | 'apify_web' | 'apify_contact' | 'patron'
}

// Cascada de búsqueda de email: para al primer éxito.
//   1. Email ya presente (del crawler de Maps).
//   2. apify~website-content-crawler sobre la web.
//   3. apify~contact-info-scraper sobre la web (respaldo).
//   4. Patrón info@{dominio} (sin verificar).
export async function buscarEmailCascada(lead: {
  email?: string | null
  web?: string | null
  descripcion?: string | null
}): Promise<EmailCascada> {
  // 1. Ya lo trajo Maps
  if (lead.email) return { email: lead.email, fuente: 'apify_maps' }

  // Email en la descripción de Maps (gratis, sin actor)
  const desdeDescripcion = extractEmailFromText(lead.descripcion ?? null)
  if (desdeDescripcion) return { email: desdeDescripcion, fuente: 'apify_maps' }

  if (lead.web) {
    // 2. website-content-crawler
    const itemsWeb = await correrActor('apify~website-content-crawler', {
      startUrls: [{ url: lead.web }],
      maxCrawlPages: 3,
      maxCrawlDepth: 1,
    })
    for (const item of itemsWeb) {
      const email = extractEmailFromText(String(item.text || item.html || item.content || ''))
      if (email) return { email, fuente: 'apify_web' }
    }

    // 3. contact-info-scraper (respaldo; si el actor no existe en la cuenta → [] y sigue)
    const itemsContact = await correrActor('vdrmota~contact-info-scraper', {
      startUrls: [{ url: lead.web }],
      maxRequestsPerStartUrl: 5,
      maxDepth: 1,
    })
    for (const item of itemsContact) {
      const emails = item.emails as string[] | undefined
      if (Array.isArray(emails) && emails.length > 0) {
        const valido = emails.find((e) => EMAIL_PRIORITY_PREFIXES.some((p) => e.toLowerCase().startsWith(p))) ?? emails[0]
        if (valido) return { email: valido, fuente: 'apify_contact' }
      }
      const email = extractEmailFromText(String(item.text || item.html || ''))
      if (email) return { email, fuente: 'apify_contact' }
    }

    // 4. Patrón de dominio
    const patron = patronDominio(lead.web)
    if (patron) return { email: patron, fuente: 'patron' }
  }

  return { email: null, fuente: 'patron' }
}
