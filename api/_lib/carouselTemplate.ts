/* ─────────────────────────────────────────────
   Plantilla HTML/CSS de un slide de carrusel (1080×1350).
   Lee colores, fuentes y logo DINÁMICAMENTE del brand kit — nada hardcodeado.
   El rol define el tratamiento visual:
     hook  → fondo degradado indigo→cyan, texto blanco (portada)
     cta   → fondo indigo sólido, texto blanco (cierre)
     resto → fondo claro de marca, texto oscuro, acento indigo
   ───────────────────────────────────────────── */

export interface CarouselBrand {
  colores: { fondo: string; indigo: string; cyan: string }
  fuentes: { headings: string; body: string }
}

export interface CarouselSlide {
  rol: 'hook' | 'problema' | 'solucion' | 'prueba_social' | 'cta'
  texto: string
}

function googleFontsHref(headings: string, body: string): string {
  const fam = (name: string) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700;800`
  const familias = [...new Set([headings, body])].map(fam).join('&')
  return `https://fonts.googleapis.com/css2?${familias}&display=swap`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function buildSlideHtml(
  slide: CarouselSlide,
  index: number,
  total: number,
  brand: CarouselBrand,
  logoUrl: string,
): string {
  const { fondo, indigo, cyan } = brand.colores
  const headings = brand.fuentes.headings
  const body = brand.fuentes.body

  const esOscuro = slide.rol === 'hook' || slide.rol === 'cta'
  const bg = slide.rol === 'hook'
    ? `linear-gradient(135deg, ${indigo} 0%, ${cyan} 100%)`
    : slide.rol === 'cta'
      ? indigo
      : fondo
  const colorTexto = esOscuro ? '#FFFFFF' : '#09090B'
  const colorAcento = esOscuro ? '#FFFFFF' : indigo
  // El hook es el más grande; el resto, tamaño de lectura cómodo
  const fontSize = slide.rol === 'hook' ? 82 : slide.rol === 'cta' ? 72 : 58
  const numero = String(index + 1).padStart(2, '0')

  // El texto puede traer saltos de línea (\n\n): los convertimos en párrafos
  const parrafos = escapeHtml(slide.texto)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${googleFontsHref(headings, body)}" rel="stylesheet"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; }
  body {
    background: ${bg};
    color: ${colorTexto};
    font-family: '${body}', sans-serif;
    padding: 96px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    -webkit-font-smoothing: antialiased;
  }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .logo-pill {
    background: #fff;
    border-radius: 16px;
    padding: 14px 20px;
    display: inline-flex;
    align-items: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }
  .logo-pill img { height: 44px; display: block; object-fit: contain; }
  .counter {
    font-family: '${body}', sans-serif;
    font-weight: 600;
    font-size: 26px;
    letter-spacing: 0.08em;
    color: ${colorAcento};
    opacity: ${esOscuro ? 0.9 : 0.5};
  }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker {
    display: inline-flex;
    align-self: flex-start;
    font-family: '${body}', sans-serif;
    font-weight: 600;
    font-size: 26px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${colorAcento};
    margin-bottom: 28px;
    ${esOscuro ? '' : `border-left: 5px solid ${cyan}; padding-left: 16px;`}
  }
  .copy {
    font-family: '${headings}', sans-serif;
    font-weight: ${slide.rol === 'hook' || slide.rol === 'cta' ? 800 : 700};
    font-size: ${fontSize}px;
    line-height: 1.18;
    letter-spacing: -0.02em;
  }
  .copy p + p { margin-top: 28px; }
  .bar { height: 8px; width: 96px; border-radius: 999px; background: ${esOscuro ? 'rgba(255,255,255,0.9)' : cyan}; }
</style>
</head>
<body>
  <div class="top">
    <div class="logo-pill"><img src="${logoUrl}" alt="logo"/></div>
    <div class="counter">${numero} / ${String(total).padStart(2, '0')}</div>
  </div>
  <div class="content">
    ${slide.rol !== 'hook' ? `<span class="kicker">${ROL_KICKER[slide.rol]}</span>` : ''}
    <div class="copy">${parrafos}</div>
  </div>
  <div class="bar"></div>
</body>
</html>`
}

const ROL_KICKER: Record<CarouselSlide['rol'], string> = {
  hook: '',
  problema: 'El problema',
  solucion: 'La solución',
  prueba_social: 'Funciona',
  cta: 'Tu siguiente paso',
}
