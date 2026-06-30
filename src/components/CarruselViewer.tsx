import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, DownloadSimple, X, CircleNotch } from '@phosphor-icons/react'
import type { PostState } from '../pages/contenido/Generador'

interface CarruselViewerProps {
  post: PostState
  tema: string
  tipoLabel: string
  onClose: () => void
}

interface Slide {
  id: string
  type: 'cover' | 'hook' | 'body' | 'cta' | 'close'
  label: string
  content: string
  index?: number
  total?: number
}

function buildSlides(post: PostState, tema: string, tipoLabel: string): Slide[] {
  const slides: Slide[] = []
  const bodyParts = post.cuerpo.filter((p) => p.trim())
  const total = 2 + bodyParts.length + 2

  slides.push({
    id: 'cover',
    type: 'cover',
    label: tipoLabel,
    content: tema,
    index: 1,
    total,
  })

  slides.push({
    id: 'hook',
    type: 'hook',
    label: 'Gancho',
    content: post.gancho,
    index: 2,
    total,
  })

  bodyParts.forEach((p, i) => {
    slides.push({
      id: `body-${i}`,
      type: 'body',
      label: `${i + 1} / ${bodyParts.length}`,
      content: p,
      index: 3 + i,
      total,
    })
  })

  slides.push({
    id: 'cta',
    type: 'cta',
    label: 'CTA',
    content: post.cta,
    index: total - 1,
    total,
  })

  slides.push({
    id: 'close',
    type: 'close',
    label: 'Cierre',
    content: post.hashtags,
    index: total,
    total,
  })

  return slides
}

export default function CarruselViewer({ post, tema, tipoLabel, onClose }: CarruselViewerProps) {
  const slides = buildSlides(post, tema, tipoLabel)
  const [current, setCurrent] = useState(0)
  const [exporting, setExporting] = useState(false)
  const slideRef = useRef<HTMLDivElement>(null)

  function prev() { setCurrent((c) => Math.max(0, c - 1)) }
  function next() { setCurrent((c) => Math.min(slides.length - 1, c + 1)) }

  async function exportarZip() {
    setExporting(true)
    try {
      const { toPng } = await import('html-to-image')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (let i = 0; i < slides.length; i++) {
        setCurrent(i)
        await new Promise((r) => setTimeout(r, 180))
        if (!slideRef.current) continue
        const dataUrl = await toPng(slideRef.current, { pixelRatio: 2, cacheBust: true })
        const base64 = dataUrl.split(',')[1]
        zip.file(`wiare-slide-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true })
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wiare-carrusel-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setCurrent(0)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const slide = slides[current]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', maxWidth: 520,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>
          Slide {slide.index} de {slide.total}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={exportarZip}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg,#6366F1,#22D3EE)',
              color: '#fff', fontWeight: 600, fontSize: 13, border: 'none',
              cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {exporting
              ? <CircleNotch size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
              : <DownloadSimple size={14} weight="bold" />
            }
            {exporting ? 'Exportando…' : 'Descargar ZIP'}
          </button>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Slide — square 1:1 Instagram ratio */}
      <div style={{ position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <SlideCanvas slide={slide} ref={slideRef} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={prev}
          disabled={current === 0}
          style={{
            width: 40, height: 40, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: current === 0 ? 'not-allowed' : 'pointer',
            opacity: current === 0 ? 0.3 : 1,
          }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 20 : 6, height: 6, borderRadius: 3,
                background: i === current ? '#6366F1' : 'rgba(255,255,255,0.25)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={current === slides.length - 1}
          style={{
            width: 40, height: 40, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: current === slides.length - 1 ? 'not-allowed' : 'pointer',
            opacity: current === slides.length - 1 ? 0.3 : 1,
          }}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

import { forwardRef } from 'react'

const SlideCanvas = forwardRef<HTMLDivElement, { slide: Slide }>(({ slide }, ref) => {
  const SIZE = 500

  const baseStyle: React.CSSProperties = {
    width: SIZE, height: SIZE,
    background: '#05050F',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'Geist', sans-serif",
    flexShrink: 0,
  }

  return (
    <div ref={ref} style={baseStyle}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {slide.type === 'cover' && <CoverSlide slide={slide} size={SIZE} />}
      {slide.type === 'hook' && <HookSlide slide={slide} size={SIZE} />}
      {slide.type === 'body' && <BodySlide slide={slide} size={SIZE} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} size={SIZE} />}
      {slide.type === 'close' && <CloseSlide slide={slide} size={SIZE} />}

      <SlideFooter index={slide.index!} total={slide.total!} />
    </div>
  )
})
SlideCanvas.displayName = 'SlideCanvas'

function GradientLine() {
  return (
    <div style={{
      height: 2, width: 48,
      background: 'linear-gradient(90deg,#6366F1,#22D3EE)',
      borderRadius: 1, marginBottom: 20,
    }} />
  )
}

function SlideFooter({ index, total }: { index: number; total: number }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 44,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      <img
        src="/logo-wiare.png"
        alt="WIARE"
        style={{ height: 20, opacity: 0.85, objectFit: 'contain' }}
      />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
        {index} / {total}
      </span>
    </div>
  )
}

function CoverSlide({ slide }: { slide: Slide; size: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '40px 36px 60px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase',
        background: 'linear-gradient(90deg,#6366F1,#22D3EE)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', marginBottom: 20,
      }}>
        {slide.label}
      </span>
      <h2 style={{
        fontSize: 30, fontWeight: 800, lineHeight: 1.2,
        color: '#F0F0FF', margin: 0, marginBottom: 24,
        fontFamily: "'Bricolage Grotesque','Inter',sans-serif",
        letterSpacing: '-0.02em',
      }}>
        {slide.content}
      </h2>
      <GradientLine />
      <span style={{ fontSize: 13, color: 'rgba(240,240,255,0.5)', fontWeight: 500 }}>
        wiare.solutions
      </span>
    </div>
  )
}

function HookSlide({ slide }: { slide: Slide; size: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '40px 36px 60px',
    }}>
      <GradientLine />
      <p style={{
        fontSize: 22, fontWeight: 700, lineHeight: 1.35,
        color: '#F0F0FF', margin: 0,
        fontFamily: "'Bricolage Grotesque','Inter',sans-serif",
        letterSpacing: '-0.01em',
      }}>
        {slide.content}
      </p>
    </div>
  )
}

function BodySlide({ slide }: { slide: Slide; size: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '36px 36px 60px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: 'rgba(99,102,241,0.8)', textTransform: 'uppercase',
        marginBottom: 18,
      }}>
        {slide.label}
      </span>
      <p style={{
        fontSize: 17, fontWeight: 500, lineHeight: 1.6,
        color: 'rgba(240,240,255,0.88)', margin: 0,
      }}>
        {slide.content}
      </p>
    </div>
  )
}

function CtaSlide({ slide }: { slide: Slide; size: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'flex-start',
      padding: '40px 36px 60px',
    }}>
      <div style={{
        display: 'inline-block', marginBottom: 20,
        padding: '6px 14px', borderRadius: 6,
        background: 'linear-gradient(135deg,#6366F1,#22D3EE)',
        fontSize: 11, fontWeight: 700, color: '#fff',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        Siguiente paso
      </div>
      <p style={{
        fontSize: 21, fontWeight: 700, lineHeight: 1.35,
        color: '#F0F0FF', margin: 0,
        fontFamily: "'Bricolage Grotesque','Inter',sans-serif",
        letterSpacing: '-0.01em',
      }}>
        {slide.content}
      </p>
    </div>
  )
}

function CloseSlide({ slide }: { slide: Slide; size: number }) {
  const tags = slide.content.split(/\s+/).filter((t) => t.startsWith('#'))
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '36px 36px 60px', gap: 20,
    }}>
      <img
        src="/logo-wiare.png"
        alt="WIARE"
        style={{ height: 32, objectFit: 'contain', opacity: 0.9 }}
      />
      <div style={{
        height: 1, width: 48,
        background: 'linear-gradient(90deg,#6366F1,#22D3EE)',
      }} />
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        justifyContent: 'center', maxWidth: 380,
      }}>
        {tags.slice(0, 10).map((t, i) => (
          <span
            key={i}
            style={{
              fontSize: 12, fontWeight: 500,
              color: 'rgba(99,102,241,0.9)',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 4, padding: '3px 8px',
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
        wiare.solutions
      </span>
    </div>
  )
}
