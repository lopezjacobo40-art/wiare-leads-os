/* Hallmark · component: carousel-slide · genre: editorial
 * theme: brand-locked (Bricolage Grotesque + Inter · indigo/cyan)
 *
 * Plantilla HTML/CSS de un slide de carrusel/historia con 3 estilos visuales,
 * todos anclados al brand kit (colores y fuentes dinámicos, nada hardcodeado):
 *
 *   - editorial: fondo blanco, jerarquía tipográfica en tinta, índice cyan,
 *     cifras en indigo, blob de degradado abajo-derecha. (El original.)
 *   - tinta: fondo casi negro, texto blanco, cifras y CTA en cyan.
 *     Máximo contraste para parar el scroll.
 *   - marca: bañado en el degradado indigo→cyan (con velo oscuro sutil para
 *     mantener contraste), texto blanco, CTA en píldora blanca.
 *
 * Sistema común: índice grande (01/05) como ancla, hook a tamaño máximo,
 * cifras/dinero resaltados, regla bajo el titular, flecha de swipe, logo.
 */

export type EstiloRender = 'editorial' | 'tinta' | 'marca'

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

/* Paleta resuelta por estilo. Todo deriva del brand kit. */
interface Paleta {
  bodyBg: string
  ink: string
  sub: string
  idx: string
  hlCss: string        // regla CSS completa para .hl
  underline: string
  decoracion: string   // CSS del elemento gráfico (.blob)
  flecha: string       // color de la flecha de swipe
  btnBg: string
  btnColor: string
  logoFilter: string
}

function paletaDe(estilo: EstiloRender, brand: CarouselBrand): Paleta {
  const { fondo, indigo, cyan } = brand.colores
  const gradiente = `linear-gradient(135deg, ${indigo} 0%, ${cyan} 100%)`

  if (estilo === 'tinta') {
    return {
      bodyBg: TINTA,
      ink: '#FFFFFF',
      sub: 'rgba(255,255,255,0.5)',
      idx: cyan,
      hlCss: `color: ${cyan}; font-weight: 800; font-size: 1.06em;`,
      underline: indigo,
      decoracion: `border-radius: 50%; background: ${gradiente}; opacity: 0.92;`,
      flecha: '#FFFFFF',
      btnBg: cyan,
      btnColor: TINTA,
      logoFilter: 'brightness(0) invert(1)',
    }
  }

  if (estilo === 'marca') {
    return {
      // Velo oscuro sutil sobre el degradado: mantiene el blanco legible también en el extremo cyan
      bodyBg: `linear-gradient(rgba(9,9,11,0.22), rgba(9,9,11,0.22)), ${gradiente}`,
      ink: '#FFFFFF',
      sub: 'rgba(255,255,255,0.7)',
      idx: 'rgba(255,255,255,0.95)',
      hlCss: `color: #fff; font-weight: 800; background: rgba(255,255,255,0.16); border-radius: 14px; padding: 0 14px;`,
      underline: 'rgba(255,255,255,0.95)',
      decoracion: `border-radius: 50%; background: transparent; border: 4px solid rgba(255,255,255,0.32);`,
      flecha: '#FFFFFF',
      btnBg: '#FFFFFF',
      btnColor: indigo,
      logoFilter: 'brightness(0) invert(1)',
    }
  }

  // editorial (por defecto)
  return {
    bodyBg: fondo,
    ink: TINTA,
    sub: GRIS,
    idx: cyan,
    hlCss: `color: ${indigo}; font-weight: 800; font-size: 1.06em;`,
    underline: cyan,
    decoracion: `border-radius: 50%; background: ${gradiente};`,
    flecha: '#FFFFFF',
    btnBg: indigo,
    btnColor: '#FFFFFF',
    logoFilter: 'none',
  }
}

export function buildSlideHtml(
  slide: CarouselSlide,
  index: number,
  total: number,
  brand: CarouselBrand,
  logoUrl: string,
  ancho = 1080,
  alto = 1350,
  estilo: EstiloRender = 'editorial',
): string {
  const headings = brand.fuentes.headings
  const body = brand.fuentes.body
  const p = paletaDe(estilo, brand)

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

  // Párrafos: en el CTA, el último se convierte en botón (píldora)
  const paras = escapeHtml(slide.texto).split(/\n{2,}/)
  const parrafos = paras
    .map((par, i) => {
      const conBr = resaltarCifras(par.replace(/\n/g, '<br/>'))
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
    background: ${p.bodyBg};
    color: ${p.ink};
    font-family: '${body}', sans-serif;
    padding: 100px;
    position: relative;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Elemento gráfico: círculo abajo-derecha, sangrando ── */
  .blob {
    position: absolute;
    right: ${vertical ? -180 : -160}px;
    bottom: ${vertical ? -180 : -160}px;
    width: ${vertical ? 620 : 500}px;
    height: ${vertical ? 620 : 500}px;
    ${p.decoracion}
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
    color: ${p.flecha};
  }

  /* ── Cabecera: índice grande + logo ── */
  .top { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; }
  .index { display: flex; align-items: baseline; }
  .index .n {
    font-family: '${headings}', sans-serif;
    font-weight: 800;
    font-size: 80px;
    line-height: 1;
    letter-spacing: -0.03em;
    color: ${p.idx};
  }
  .index .tot {
    font-family: '${body}', sans-serif;
    font-weight: 600;
    font-size: 30px;
    color: ${p.sub};
    margin-left: 10px;
  }
  .logo { height: 72px; object-fit: contain; display: block; filter: ${p.logoFilter}; }

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
  /* Cifras/dinero resaltadas según el estilo */
  .copy .hl { ${p.hlCss} }

  /* ── Regla bajo el titular ── */
  .underline { height: 14px; width: 190px; border-radius: 999px; background: ${p.underline}; margin-top: 48px; }

  /* ── Botón (CTA): píldora con flecha ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 18px;
    margin-top: 44px;
    padding: 26px 46px;
    background: ${p.btnBg};
    color: ${p.btnColor};
    border-radius: 999px;
    font-family: '${headings}', sans-serif;
    font-weight: 700;
    font-size: ${Math.round(base * 0.52)}px;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .btn .hl { color: ${p.btnColor}; background: transparent; padding: 0; font-size: 1em; }
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
