import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, DownloadSimple, ArrowsOut, ArrowsIn, CheckCircle,
  Phone, CalendarCheck, ChartLineUp, Wrench, Bell, Sparkle, PawPrint,
  HouseLine, GraduationCap, Heart, FirstAid, TrendUp, UserCircle,
  Broadcast, ArrowClockwise,
} from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import type { SlidesContent } from '../lib/claudeApi'

// Mapa de icono string → componente Phosphor
const ICON_MAP: Record<string, PhosphorIcon> = {
  Phone, CalendarCheck, ChartLineUp, Wrench, Bell, Sparkle, PawPrint,
  HouseLine, GraduationCap, Heart, FirstAid, TrendUp, UserCircle,
  Broadcast, ArrowClockwise,
}

function SlideIcon({ name, size = 32 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Phone
  return <Icon size={size} weight="fill" />
}

interface Props {
  slides: SlidesContent
  nombreNegocio: string
}

const TOTAL = 7

export default function PropuestaSlides({ slides, nombreNegocio }: Props) {
  const [current, setCurrent] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [pdfEstado, setPdfEstado] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const prev = () => setCurrent((c) => Math.max(0, c - 1))
  const next = () => setCurrent((c) => Math.min(TOTAL - 1, c + 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'Escape') setFullscreen(false)
  }

  const descargarPDF = async () => {
    const el = document.getElementById('wiare-slides-export')
    if (!el) return
    setPdfEstado('loading')
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const opciones = {
        margin: 0,
        filename: `Propuesta-Slides-${nombreNegocio.replace(/\s+/g, '-')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#05050F' },
        jsPDF: { unit: 'px', format: [1280, 720] as [number, number], orientation: 'landscape' as const },
        pagebreak: { mode: 'avoid-all' },
      }
      await html2pdf().set(opciones).from(el).save()
      setPdfEstado('done')
      setTimeout(() => setPdfEstado('idle'), 3000)
    } catch {
      setPdfEstado('error')
      setTimeout(() => setPdfEstado('idle'), 3000)
    }
  }

  const wrapperStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#000', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }
    : { position: 'relative' }

  return (
    <div
      className="wiare-slides"
      style={wrapperStyle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Presentación de propuesta"
    >
      {/* ── Controles superiores ── */}
      <div
        className="no-print"
        style={{
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
          ...(fullscreen ? { position: 'absolute', top: 16, right: 16, zIndex: 10 } : {}),
        }}
      >
        <button className="btn-secondary" onClick={descargarPDF} disabled={pdfEstado === 'loading'}
          style={{ fontSize: 12, padding: '6px 12px', minHeight: 32, gap: 6 }}>
          {pdfEstado === 'loading' ? (
            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generando…</>
          ) : pdfEstado === 'done' ? (
            <><CheckCircle size={14} weight="fill" style={{ color: 'var(--color-success)' }} /> Descargado</>
          ) : (
            <><DownloadSimple size={14} /> PDF</>
          )}
        </button>
        <button className="btn-secondary" onClick={() => setFullscreen((v) => !v)}
          style={{ fontSize: 12, padding: '6px 12px', minHeight: 32, gap: 6 }}>
          {fullscreen ? <><ArrowsIn size={14} /> Salir</> : <><ArrowsOut size={14} /> Pantalla completa</>}
        </button>
      </div>

      {/* ── Viewport del slide (escalado para caber en pantalla) ── */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          borderRadius: fullscreen ? 0 : 12,
          boxShadow: fullscreen ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Contenedor de escala: 1280×720 real, escalado con transform */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              transformOrigin: 'top left',
              // Escala relativa al contenedor padre: 100vw → 1280px
              transform: 'scale(calc(1 / (1280 / 100%)))',
            }}
          >
            <div id="wiare-slides-export" style={{ width: 1280, height: 720 * TOTAL, background: '#05050F' }}>
              {Array.from({ length: TOTAL }, (_, i) => (
                <div
                  key={i}
                  className={`slide${i === current ? ' slide-active' : ''}`}
                  style={{ display: i === current ? 'block' : 'none' }}
                >
                  <SlideContent index={i} slides={slides} nombreNegocio={nombreNegocio} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navegación ── */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16,
      }}>
        <button
          className="btn-secondary"
          onClick={prev} disabled={current === 0}
          style={{ padding: '6px 14px', minHeight: 36, gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Anterior
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                background: i === current ? 'var(--color-primary)' : 'var(--color-border-strong)',
                padding: 0,
                minHeight: 'auto',
                transition: 'width 200ms cubic-bezier(0.4,0,0.2,1), background 150ms',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <button
          className="btn-secondary"
          onClick={next} disabled={current === TOTAL - 1}
          style={{ padding: '6px 14px', minHeight: 36, gap: 6, fontSize: 13 }}
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>

      {/* ── Thumbnails ── */}
      <div className="no-print" style={{
        display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4,
        justifyContent: 'center',
      }}>
        {SLIDE_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              border: i === current ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
              background: i === current ? 'var(--color-primary-subtle)' : '#fff',
              color: i === current ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              minHeight: 'auto', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'border-color 150ms, color 150ms, background 150ms',
            }}
          >
            {String(i + 1).padStart(2, '0')} {label}
          </button>
        ))}
      </div>
    </div>
  )
}

const SLIDE_LABELS = ['Apertura', 'El problema', 'El coste real', 'La solución', 'Implementación', 'Reflexión', 'Cierre']

/* ─── Contenido de cada slide ─── */
function SlideContent({ index, slides, nombreNegocio }: { index: number; slides: SlidesContent; nombreNegocio: string }) {
  switch (index) {
    case 0: return <Slide1 data={slides.slide1} nombreNegocio={nombreNegocio} />
    case 1: return <Slide2 data={slides.slide2} />
    case 2: return <Slide3 data={slides.slide3} />
    case 3: return <Slide4 data={slides.slide4} />
    case 4: return <Slide5 data={slides.slide5} />
    case 5: return <Slide6 data={slides.slide6} />
    case 6: return <Slide7 data={slides.slide7} nombreNegocio={nombreNegocio} />
    default: return null
  }
}

/* Decoración de fondo (grid sutil) común a todos los slides */
function SlideBg() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
    }} />
  )
}

/* Número de slide decorativo */
function SlideNum({ n }: { n: number }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 120,
      position: 'absolute', right: 48, bottom: -20,
      color: 'rgba(99,102,241,0.06)', lineHeight: 1, userSelect: 'none',
    }}>
      {String(n).padStart(2, '0')}
    </span>
  )
}

/* Logo WIARE común a todos los slides */
function SlideLogo() {
  return (
    <img
      src="/logo-wiare-blanco.png"
      alt="WIARE"
      style={{ height: 28, objectFit: 'contain', objectPosition: 'left center', filter: 'brightness(1)' }}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement
        img.src = '/logo-wiare.png'
        img.style.filter = 'brightness(0) invert(1)'
      }}
    />
  )
}

/* ── Slide 01 — Apertura ── */
function Slide1({ data, nombreNegocio }: { data: SlidesContent['slide1']; nombreNegocio: string }) {
  return (
    <div style={{ width: 1280, height: 720, background: 'var(--slide-bg)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 120px' }}>
      <SlideBg />
      {/* Acento de color izquierdo */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'var(--slide-gradient)' }} />

      <div style={{ position: 'absolute', top: 48, right: 48 }}>
        <SlideLogo />
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--slide-text-muted)', marginBottom: 24 }}>
        Propuesta para {nombreNegocio}
      </p>

      <h1
        className="gradient-text"
        style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 64, lineHeight: 1.1, maxWidth: 900, marginBottom: 40,
        }}
      >
        {data.tagline}
      </h1>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 999, padding: '10px 24px',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--slide-text)' }}>
          Sistema de atención 24/7 · Activo en 7 días
        </span>
      </div>

      <SlideNum n={1} />
    </div>
  )
}

/* ── Slide 02 — El problema ── */
function Slide2({ data }: { data: SlidesContent['slide2'] }) {
  return (
    <div style={{ width: 1280, height: 720, background: 'var(--slide-surface)', position: 'relative', display: 'flex', flexDirection: 'column', padding: '64px 80px' }}>
      <SlideBg />
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SlideLogo />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>02 / El problema</span>
      </div>

      <div style={{
        display: 'inline-block', marginTop: 24, marginBottom: 32,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 999, padding: '8px 20px',
        fontSize: 14, fontWeight: 600, color: '#FCA5A5',
      }}>
        {data.estadistica}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, flex: 1 }}>
        {data.pain_points.map((pp, i) => (
          <div key={i} style={{
            background: 'var(--slide-surface-2)', border: '1px solid var(--slide-border)',
            borderRadius: 16, padding: 28,
            borderTop: '3px solid rgba(239,68,68,0.5)',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36,
              color: 'rgba(239,68,68,0.15)', marginBottom: 8, lineHeight: 1,
            }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--slide-text)', marginBottom: 10, lineHeight: 1.3 }}>
              {pp.titulo}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--slide-text-muted)', lineHeight: 1.6 }}>
              {pp.descripcion}
            </p>
          </div>
        ))}
      </div>
      <SlideNum n={2} />
    </div>
  )
}

/* ── Slide 03 — El coste real ── */
function Slide3({ data }: { data: SlidesContent['slide3'] }) {
  const { perdida_mensual, perdida_anual, sin_sistema, con_sistema } = data
  return (
    <div style={{ width: 1280, height: 720, background: 'var(--slide-bg)', position: 'relative', display: 'flex', flexDirection: 'column', padding: '64px 80px' }}>
      <SlideBg />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <SlideLogo />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>03 / El coste real</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, flex: 1 }}>
        {/* Métrica principal */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slide-text-muted)', marginBottom: 8 }}>
            Pérdida mensual
          </p>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 88,
            color: 'var(--slide-loss)', lineHeight: 1,
          }}>
            {perdida_mensual.toLocaleString('es-ES')}€
          </div>
          <p style={{ fontSize: 14, color: 'var(--slide-text-muted)', marginTop: 8 }}>
            {perdida_anual.toLocaleString('es-ES')}€ al año
          </p>
        </div>

        {/* Sin sistema */}
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FCA5A5', marginBottom: 20 }}>Sin sistema</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sin_sistema.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>×</span>
                <span style={{ fontSize: 14, color: 'var(--slide-text-muted)', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Con sistema */}
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#86EFAC', marginBottom: 20 }}>Con WIARE</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {con_sistema.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#22C55E', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 14, color: 'var(--slide-text-muted)', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SlideNum n={3} />
    </div>
  )
}

/* ── Slide 04 — La solución ── */
function Slide4({ data }: { data: SlidesContent['slide4'] }) {
  return (
    <div style={{ width: 1280, height: 720, background: 'var(--slide-surface)', position: 'relative', display: 'flex', flexDirection: 'column', padding: '64px 80px' }}>
      <SlideBg />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <SlideLogo />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>04 / La solución</span>
      </div>

      <h2 className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, marginBottom: 40 }}>
        {data.titulo}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {data.beneficios.map((b, i) => (
          <div key={i} style={{
            background: 'var(--slide-surface-2)', border: '1px solid var(--slide-border)',
            borderRadius: 16, padding: 32,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(34,211,238,0.2) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, color: '#818CF8',
            }}>
              <SlideIcon name={b.icono} size={24} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--slide-text)', marginBottom: 10, lineHeight: 1.3 }}>
              {b.titulo}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--slide-text-muted)', lineHeight: 1.6 }}>
              {b.descripcion}
            </p>
          </div>
        ))}
      </div>
      <SlideNum n={4} />
    </div>
  )
}

/* ── Slide 05 — Implementación ── */
function Slide5({ data }: { data: SlidesContent['slide5'] }) {
  return (
    <div style={{ width: 1280, height: 720, background: 'var(--slide-bg)', position: 'relative', display: 'flex', flexDirection: 'column', padding: '64px 120px', justifyContent: 'center' }}>
      <SlideBg />
      <div style={{ position: 'absolute', top: 48, right: 48 }}>
        <SlideLogo />
      </div>
      <span style={{ position: 'absolute', top: 48, left: 48, fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>
        05 / Implementación
      </span>

      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color: 'var(--slide-text)', marginBottom: 56 }}>
        Activo en{' '}
        <span className="gradient-text">7 días</span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.pasos.map((paso, i) => (
          <div key={i} style={{ display: 'flex', gap: 32, alignItems: 'flex-start', position: 'relative' }}>
            {/* Línea conectora */}
            {i < data.pasos.length - 1 && (
              <div style={{
                position: 'absolute', left: 24, top: 52, bottom: -24,
                width: 2, background: 'rgba(99,102,241,0.2)',
              }} />
            )}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'var(--slide-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: '#fff',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>
              {i + 1}
            </div>
            <div style={{ paddingBottom: i < data.pasos.length - 1 ? 32 : 0 }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--slide-text)', lineHeight: 1.5 }}>{paso}</p>
            </div>
          </div>
        ))}
      </div>

      <SlideNum n={5} />
    </div>
  )
}

/* ── Slide 06 — Reflexión / pregunta ── */
function Slide6({ data }: { data: SlidesContent['slide6'] }) {
  return (
    <div style={{
      width: 1280, height: 720,
      background: 'linear-gradient(135deg, #0D0D2F 0%, #05050F 60%, #0D1A0D 100%)',
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '80px 160px',
    }}>
      <SlideBg />
      <div style={{ position: 'absolute', top: 48, left: 48 }}>
        <SlideLogo />
      </div>
      <span style={{ position: 'absolute', top: 48, right: 48, fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>
        06 / Reflexión
      </span>

      {/* Comilla decorativa */}
      <div style={{ fontSize: 120, lineHeight: 0.8, color: 'rgba(99,102,241,0.15)', fontFamily: 'Georgia, serif', marginBottom: 32 }}>
        "
      </div>

      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 40, lineHeight: 1.3, textAlign: 'center',
        color: 'var(--slide-text)', maxWidth: 800,
      }}>
        {data.pregunta}
      </h2>

      <SlideNum n={6} />
    </div>
  )
}

/* ── Slide 07 — Cierre / CTA ── */
function Slide7({ data, nombreNegocio }: { data: SlidesContent['slide7']; nombreNegocio: string }) {
  return (
    <div style={{
      width: 1280, height: 720,
      background: 'var(--slide-bg)',
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '64px 80px',
    }}>
      <SlideBg />
      {/* Franja de gradiente superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--slide-gradient)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
        <SlideLogo />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--slide-text-muted)' }}>07 / Siguiente paso</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2
          className="gradient-text"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 52, lineHeight: 1.2, marginBottom: 32, maxWidth: 800 }}
        >
          {data.cta}
        </h2>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
          {data.tiene_demo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 12, padding: '12px 20px',
            }}>
              <span style={{ color: '#818CF8' }}><Phone size={18} weight="fill" /></span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--slide-text)' }}>Demo de voz ya disponible para {nombreNegocio}</span>
            </div>
          )}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 12, padding: '12px 20px',
          }}>
            <span style={{ color: '#22C55E' }}><CalendarCheck size={18} weight="fill" /></span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--slide-text)' }}>Reunión de 30 min · Sin compromiso</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--slide-border)', paddingTop: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--slide-text-muted)' }}>
            WIARE · holawiare@gmail.com · wiaresolution.com
          </p>
        </div>
      </div>
      <SlideNum n={7} />
    </div>
  )
}
