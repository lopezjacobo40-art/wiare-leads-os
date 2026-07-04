/* Hallmark · component: carousel-slide · genre: editorial
 * theme: brand-locked (Bricolage Grotesque + Inter · indigo/cyan on brand paper)
 * pre-emit critique: P5 H5 E4 S4 R5 V4
 *
 * Plantilla HTML/CSS de un slide de carrusel (1080×1350), estilo editorial/suizo.
 * Fondo blanco limpio; toda la fuerza en la jerarquía tipográfica y el color.
 * Lee colores, fuentes y logo DINÁMICAMENTE del brand kit — nada hardcodeado.
 *
 * Sistema:
 *   - Índice grande (01/05) en cyan = ancla y ritmo (sustituye a las etiquetas tipo eyebrow).
 *   - Cifras/dinero/porcentajes se resaltan solos en indigo, más grandes → contraste de escala + color.
 *   - Hook = tamaño máximo (portada). CTA = línea de acción en indigo.
 *   - Regla cyan + flecha de swipe abajo. Logo arriba a la derecha.
 */

export interface CarouselBrand {
  colores: { fondo: string; indigo: string; cyan: string }
  fuentes: { headings: string; body: string }
}

export interface CarouselSlide {
  rol: 'hook' | 'problema' | 'solucion' | 'prueba_social' | 'cta'
  texto: string
}

const TINTA = '#09090B'
const GRIS = '#A1A1AA'

function googleFontsHref(headings: string, body: string): string {
  const fam = (name: string) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700;800`
  const familias = [...new Set([headings, body])].map(fam).join('&')
  return `https://fonts.googleapis.com/css2?${familias}&display=swap`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/* Resalta cifras, dinero, porcentajes, rangos (6-8) y ratios (24/7) en color de marca. */
function resaltarCifras(htmlEscapado: string): string {
  return htmlEscapado.replace(/(\+?\d[\d.,]*\s?(?:€|%)|\d+\/\d+|\d+-\d+|\+?\d[\d.,]*)/g, '<span class="hl">$1</span>')
}

export function buildSlideHtml(
  slide: CarouselSlide,
  index: number,
  total: number,
  brand: CarouselBrand,
  logoUrl: string,
  ancho = 1080,
  alto = 1350,
): string {
  const { fondo, indigo, cyan } = brand.colores
  const headings = brand.fuentes.headings
  const body = brand.fuentes.body

  // El formato vertical (historias 9:16) da más aire; el cuadrado 1:1, menos
  const vertical = alto / ancho >= 1.5

  // Tamaño base por rol; se reduce si el texto es largo (fit tipográfico)
  const len = slide.texto.length
  let base = slide.rol === 'hook' ? 108 : slide.rol === 'cta' ? 82 : 78
  if (len > 150) base = Math.round(base * 0.84)
  if (len > 230) base = Math.round(base * 0.72)

  const numero = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')
  const esUltimo = index >= total - 1

  // Párrafos: en el CTA, el último se convierte en botón (píldora indigo)
  const paras = escapeHtml(slide.texto).split(/\n{2,}/)
  const parrafos = paras
    .map((p, i) => {
      const conBr = resaltarCifras(p.replace(/\n/g, '<br/>'))
      const esBoton = slide.rol === 'cta' && i === paras.length - 1
      return esBoton
        ? `<span class="btn">${conBr} <span class="btn-arrow">&rarr;</span></span>`
        : `<p>${conBr}</p>`
    })
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
  html, body { width: ${ancho}px; height: ${alto}px; }
  body {
    background: ${fondo};
    color: ${TINTA};
    font-family: '${body}', sans-serif;
    padding: 100px;
    position: relative;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Elemento gráfico: círculo de degradado de marca, abajo-derecha, sangrando ── */
  .blob {
    position: absolute;
    right: ${vertical ? -180 : -160}px;
    bottom: ${vertical ? -180 : -160}px;
    width: ${vertical ? 620 : 500}px;
    height: ${vertical ? 620 : 500}px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${indigo} 0%, ${cyan} 100%);
    z-index: 0;
  }
  .blob-arrow {
    position: absolute;
    right: 150px;
    bottom: 172px;
    z-index: 1;
    font-family: '${headings}', sans-serif;
    font-weight: 800;
    font-size: 84px;
    line-height: 1;
    color: #fff;
  }

  /* ── Cabecera: índice grande (cyan) + logo ── */
  .top { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; }
  .index { display: flex; align-items: baseline; }
  .index .n {
    font-family: '${headings}', sans-serif;
    font-weight: 800;
    font-size: 80px;
    line-height: 1;
    letter-spacing: -0.03em;
    color: ${cyan};
  }
  .index .tot {
    font-family: '${body}', sans-serif;
    font-weight: 600;
    font-size: 30px;
    color: ${GRIS};
    margin-left: 10px;
  }
  .logo { height: 72px; object-fit: contain; display: block; }

  /* ── Copy: arriba, la jerarquía tipográfica es el diseño ── */
  .content { position: relative; z-index: 2; margin-top: ${vertical ? 240 : 76}px; }
  .copy {
    font-family: '${headings}', sans-serif;
    font-weight: ${slide.rol === 'hook' ? 800 : 700};
    font-size: ${base}px;
    line-height: 1.08;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .copy p + p { margin-top: 30px; }
  /* Cifras/dinero: color de marca, un punto más grandes */
  .copy .hl { color: ${indigo}; font-weight: 800; font-size: 1.06em; }

  /* ── Subrayado cyan bajo el titular ── */
  .underline { height: 14px; width: 190px; border-radius: 999px; background: ${cyan}; margin-top: 48px; }

  /* ── Botón (CTA): píldora indigo con flecha ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 18px;
    margin-top: 44px;
    padding: 26px 46px;
    background: ${indigo};
    color: #fff;
    border-radius: 999px;
    font-family: '${headings}', sans-serif;
    font-weight: 700;
    font-size: ${Math.round(base * 0.52)}px;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .btn .hl { color: #fff; }
  .btn-arrow { font-weight: 800; }
</style>
</head>
<body>
  <div class="blob"></div>
  ${esUltimo ? '' : '<div class="blob-arrow">&rarr;</div>'}
  <div class="top">
    <div class="index"><span class="n">${numero}</span><span class="tot">/ ${totalStr}</span></div>
    <img class="logo" src="${logoUrl}" alt="logo"/>
  </div>
  <div class="content">
    <div class="copy">${parrafos}</div>
    ${slide.rol === 'cta' ? '' : '<div class="underline"></div>'}
  </div>
</body>
</html>`
}
