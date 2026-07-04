import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { requireAuth } from './_lib/verifyAuth.js'
import { buildSlideHtml, type CarouselBrand, type CarouselSlide } from './_lib/carouselTemplate.js'

/* Renderiza los slides de un carrusel a PNG 1080×1350 con Chromium headless,
   los sube a Supabase Storage (bucket carousels) y devuelve las URLs públicas.
   Acepta onlySlide (índice) para regenerar un solo slide. */

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireAuth(req, res))) return

  const { ideaId, slides, brand, logoUrl, onlySlide } = req.body as {
    ideaId: string
    slides: CarouselSlide[]
    brand: CarouselBrand
    logoUrl: string
    onlySlide?: number
  }

  if (!ideaId || !Array.isArray(slides) || slides.length === 0 || !brand || !logoUrl) {
    return res.status(400).json({ error: 'Faltan datos: ideaId, slides, brand o logoUrl' })
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing Supabase config on server' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const total = slides.length
  // Índices a renderizar: todos, o solo uno si viene onlySlide
  const indices = typeof onlySlide === 'number' ? [onlySlide] : slides.map((_, i) => i)

  let browser
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    const resultados: { rol: string; url: string }[] = []

    for (const i of indices) {
      const slide = slides[i]
      const page = await browser.newPage()
      await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 })
      await page.setContent(buildSlideHtml(slide, i, total, brand, logoUrl), { waitUntil: 'networkidle0' })
      // Asegura que las fuentes web estén cargadas antes de la captura
      try { await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready) } catch { /* noop */ }

      const png = (await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } })) as Buffer
      await page.close()

      const path = `${ideaId}/slide-${i + 1}-${slide.rol}.png`
      const { error: upErr } = await supabase.storage
        .from('carousels')
        .upload(path, png, { contentType: 'image/png', upsert: true })
      if (upErr) throw new Error(`Storage: ${upErr.message}`)

      const { data: pub } = supabase.storage.from('carousels').getPublicUrl(path)
      // Cache-buster para que la vista previa refresque tras regenerar
      resultados.push({ rol: slide.rol, url: `${pub.publicUrl}?v=${Date.now()}` })
    }

    return res.status(200).json({ imagenes: resultados })
  } catch (err) {
    console.error('render-carousel error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error renderizando el carrusel' })
  } finally {
    if (browser) await browser.close()
  }
}
