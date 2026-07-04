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
): string {
  const { fondo, indigo, cyan } = brand.colores
  const headings = brand.fuentes.headings
  const body = brand.fuentes.body

  // Tamaño base por rol; se reduce si el texto es largo (fit tipográfico)
  const len = slide.texto.length
  let base = slide.rol === 'hook' ? 108 : slide.rol === 'cta' ? 82 : 78
  if (len > 150) base = Math.round(base * 0.84)
  if (len > 230) base = Math.round(base * 0.72)

  const numero = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')
  const esUltimo = index >= total - 1

  // Párrafos: en el CTA, el último se marca como acción (indigo)
  const paras = escapeHtml(slide.texto).split(/\n{2,}/)
  const parrafos = paras
    .map((p, i) => {
      const conBr = resaltarCifras(p.replace(/\n/g, '<br/>'))
      const accion = slide.rol === 'cta' && i === paras.length - 1
      return `<p class="${accion ? 'action' : ''}">${conBr}</p>`
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
  html, body { width: 1080px; height: 1350px; }
  body {
    background: ${fondo};
    color: ${TINTA};
    font-family: '${body}', sans-serif;
    padding: 100px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  /* ── Cabecera: índice grande (cyan) + logo ── */
  .top { display: flex; align-items: flex-start; justify-content: space-between; }
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
  .logo { height: 44px; object-fit: contain; display: block; }

  /* ── Copy: arriba, la jerarquía tipográfica es el diseño ── */
  .content { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 72px; }
  .copy {
    font-family: '${headings}', sans-serif;
    font-weight: ${slide.rol === 'hook' ? 800 : 700};
    font-size: ${base}px;
    line-height: 1.08;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .copy p + p { margin-top: 30px; }
  /* Cifras/dinero: color de marca + un punto más de tamaño y peso */
  .copy .hl { color: ${indigo}; font-weight: 800; font-size: 1.06em; }
  /* Línea de acción del CTA */
  .copy p.action { color: ${indigo}; }
  .copy p.action .hl { color: ${TINTA}; }

  /* ── Pie: regla cyan + flecha de swipe ── */
  .bottom { display: flex; align-items: center; justify-content: space-between; }
  .rule { height: 8px; width: 104px; border-radius: 999px; background: ${cyan}; }
  .swipe {
    font-family: '${headings}', sans-serif;
    font-weight: 700;
    font-size: 44px;
    color: ${indigo};
    line-height: 1;
  }
</style>
</head>
<body>
  <div class="top">
    <div class="index"><span class="n">${numero}</span><span class="tot">/ ${totalStr}</span></div>
    <img class="logo" src="${logoUrl}" alt="logo"/>
  </div>
  <div class="content">
    <div class="copy">${parrafos}</div>
  </div>
  <div class="bottom">
    <div class="rule"></div>
    ${esUltimo ? '' : '<div class="swipe">&rarr;</div>'}
  </div>
</body>
</html>`
}
