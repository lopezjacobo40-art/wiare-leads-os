import JSZip from 'jszip'
import { authHeaders } from './supabaseClient'
import type { BrandKit } from './brandKit'
import type { CopySlide, CarruselImagen } from './contentIdeas'

/* Cliente del render de carruseles. Llama a /api/render-carousel (Puppeteer
   server-side) con el brand kit + los slides. onlySlide regenera uno solo. */
export async function renderCarrusel(params: {
  ideaId: string
  slides: CopySlide[]
  brand: BrandKit
  onlySlide?: number
}): Promise<CarruselImagen[]> {
  const { ideaId, slides, brand, onlySlide } = params
  // El logo puede ser una ruta relativa (/logo-wiare.png): la volvemos absoluta
  const logoUrl = brand.logo_url
    ? (brand.logo_url.startsWith('http') ? brand.logo_url : `${window.location.origin}${brand.logo_url}`)
    : `${window.location.origin}/logo-wiare.png`

  const res = await fetch('/api/render-carousel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      ideaId,
      slides,
      brand: { colores: brand.colores, fuentes: brand.fuentes },
      logoUrl,
      onlySlide,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status} al renderizar`)
  }
  const data = await res.json()
  return data.imagenes as CarruselImagen[]
}

/* Descarga los slides como un ZIP en el navegador. */
export async function descargarZip(imagenes: CarruselImagen[], nombreBase: string): Promise<void> {
  const zip = new JSZip()
  await Promise.all(
    imagenes.map(async (img, i) => {
      const blob = await fetch(img.url).then((r) => r.blob())
      zip.file(`slide-${i + 1}-${img.rol}.png`, blob)
    }),
  )
  const contenido = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(contenido)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreBase.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'carrusel'}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
