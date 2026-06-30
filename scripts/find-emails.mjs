import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Regex para encontrar emails en HTML
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Emails que no sirven — descartarlos
const EMAIL_BLACKLIST = [
  'noreply', 'no-reply', 'privacy', 'legal', 'gdpr',
  'wordpress', 'woocommerce', 'shopify', 'example',
  'test@', 'admin@', 'webmaster@', 'support@'
]

// Emails que SÍ sirven — priorizarlos
const EMAIL_PRIORITY = [
  'info@', 'hola@', 'contacto@', 'contact@',
  'reservas@', 'citas@', 'clinica@', 'dental@',
  'recepcion@', 'administracion@', 'gerencia@'
]

function fetchURL(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
        'Accept': 'text/html'
      },
      timeout: 8000
    }

    const req = protocol.get(url, options, (res) => {
      // Seguir redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location
        if (redirectUrl) {
          fetchURL(redirectUrl.startsWith('http')
            ? redirectUrl
            : new URL(redirectUrl, url).href
          ).then(resolve)
          return
        }
      }

      let data = ''
      res.on('data', chunk => {
        data += chunk
        // Parar después de 200KB — suficiente para encontrar emails
        if (data.length > 200000) req.destroy()
      })
      res.on('end', () => resolve(data))
    })

    req.on('error', () => resolve(''))
    req.on('timeout', () => { req.destroy(); resolve('') })
  })
}

function extractEmails(html, dominio) {
  const found = html.match(EMAIL_REGEX) || []

  // Filtrar emails del mismo dominio o válidos
  const validos = found.filter(email => {
    const emailLower = email.toLowerCase()

    // Descartar blacklist
    if (EMAIL_BLACKLIST.some(b => emailLower.includes(b))) return false

    // Descartar emails de plataformas externas
    if (emailLower.includes('sentry.') ||
        emailLower.includes('google.') ||
        emailLower.includes('facebook.') ||
        emailLower.includes('instagram.')) return false

    // Priorizar emails del mismo dominio
    if (dominio && emailLower.includes(dominio)) return true

    // Aceptar emails genéricos válidos
    if (EMAIL_PRIORITY.some(p => emailLower.startsWith(p))) return true

    return true
  })

  // Ordenar por prioridad: dominio propio primero, luego genéricos
  return validos.sort((a, b) => {
    const aPropio = dominio && a.toLowerCase().includes(dominio)
    const bPropio = dominio && b.toLowerCase().includes(dominio)
    if (aPropio && !bPropio) return -1
    if (!aPropio && bPropio) return 1

    const aPriority = EMAIL_PRIORITY.findIndex(p =>
      a.toLowerCase().startsWith(p))
    const bPriority = EMAIL_PRIORITY.findIndex(p =>
      b.toLowerCase().startsWith(p))

    if (aPriority !== -1 && bPriority === -1) return -1
    if (aPriority === -1 && bPriority !== -1) return 1
    return 0
  })
}

async function buscarEmailEnWeb(web) {
  if (!web) return null

  // Normalizar URL
  let url = web
  if (!url.startsWith('http')) url = 'https://' + url

  // Extraer dominio
  let dominio = ''
  try {
    dominio = new URL(url).hostname.replace('www.', '')
  } catch { return null }

  console.log(`  Buscando en: ${url}`)

  // Intentar primero la página principal
  let html = await fetchURL(url)
  let emails = extractEmails(html, dominio)

  // Si no encontramos nada, intentar /contacto o /contact
  if (emails.length === 0) {
    const contactUrls = [
      url.replace(/\/$/, '') + '/contacto',
      url.replace(/\/$/, '') + '/contact',
      url.replace(/\/$/, '') + '/contactanos',
      url.replace(/\/$/, '') + '/sobre-nosotros',
    ]

    for (const contactUrl of contactUrls) {
      html = await fetchURL(contactUrl)
      emails = extractEmails(html, dominio)
      if (emails.length > 0) break
    }
  }

  return emails.length > 0 ? emails[0] : null
}

async function main() {
  console.log('🔍 Buscando emails en webs de leads...\n')

  // Obtener leads con web pero sin email
  const { data: leads, error } = await supabase
    .from('leads_os')
    .select('id, nombre, web, email')
    .not('web', 'is', null)
    .or('email.is.null,email.eq.')
    .order('score_cualificacion', { ascending: false })

  if (error) {
    console.error('Error al obtener leads:', error)
    process.exit(1)
  }

  console.log(`📋 ${leads.length} leads con web y sin email\n`)

  let encontrados = 0
  let noEncontrados = 0

  for (const lead of leads) {
    console.log(`\n[${leads.indexOf(lead) + 1}/${leads.length}] ${lead.nombre}`)

    const email = await buscarEmailEnWeb(lead.web)

    if (email) {
      // Guardar en Supabase
      const { error: updateError } = await supabase
        .from('leads_os')
        .update({
          email: email,
          email_fuente: 'web_scraping',
          email_verificado: false
        })
        .eq('id', lead.id)

      if (!updateError) {
        console.log(`  ✅ Email encontrado: ${email}`)
        encontrados++
      } else {
        console.log(`  ❌ Error guardando: ${updateError.message}`)
      }
    } else {
      console.log(`  ⚠️  Sin email encontrado`)
      noEncontrados++
    }

    // Pausa entre requests para no saturar
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Emails encontrados: ${encontrados}`)
  console.log(`⚠️  Sin email: ${noEncontrados}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(console.error)
