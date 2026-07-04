import { useEffect, useState } from 'react'
import { X, Sparkle, FloppyDisk, Rows, VideoCamera } from '@phosphor-icons/react'
import { useToast } from '../Toast'
import { useBrandKit } from '../../lib/brandKit'
import { generarCopyCarrusel } from '../../lib/claudeApi'
import { actualizarIdea, SLIDE_ROLES, type ContentIdea, type CopySlide } from '../../lib/contentIdeas'

/* Detalle de una idea: genera y edita el copy del carrusel (5 slides).
   El copy se guarda como borrador editable en la idea. NO se renderiza aún (eso es Fase 4). */
export default function IdeaDrawer({
  idea, pilarNombre, ejemplosTono, onClose, onSaved,
}: {
  idea: ContentIdea
  pilarNombre?: string
  ejemplosTono: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { brand } = useBrandKit()
  const indigo = brand?.colores.indigo ?? '#6366F1'

  const [slides, setSlides] = useState<CopySlide[]>([])
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSlides(idea.copy_slides ?? [])
    setDirty(false)
  }, [idea])

  const puedeGenerar = idea.estado !== 'idea' // se genera al pasar la idea a "En progreso"

  const generar = async () => {
    setGenerando(true)
    try {
      const generado = await generarCopyCarrusel(
        { titulo: idea.titulo, gancho: idea.gancho, pilar: pilarNombre },
        ejemplosTono,
        brand?.tono_voz,
      )
      setSlides(generado)
      setDirty(true)
      toast('Copy generado. Revísalo y guárdalo.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar el copy', 'error')
    } finally {
      setGenerando(false)
    }
  }

  const editarSlide = (i: number, texto: string) => {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, texto } : s)))
    setDirty(true)
  }

  const guardar = async () => {
    setGuardando(true)
    const { error } = await actualizarIdea(idea.id, { copy_slides: slides })
    setGuardando(false)
    if (error) {
      toast(`Error al guardar: ${error}`, 'error')
    } else {
      setDirty(false)
      toast('Copy guardado como borrador', 'success')
      onSaved()
    }
  }

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 199, animation: 'fade-in 200ms cubic-bezier(0.4,0,0.2,1)' }} />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)',
          background: '#fff', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)',
          zIndex: 200, display: 'flex', flexDirection: 'column',
          animation: 'quickview-in 250ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={onClose} aria-label="Cerrar" className="btn-ghost" style={{ padding: 8, minHeight: 44, minWidth: 44 }}>
              <X size={18} />
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', padding: '3px 10px' }}>
              {idea.formato === 'video' ? <VideoCamera size={12} weight="fill" /> : <Rows size={12} weight="fill" />}
              {idea.formato === 'video' ? 'Vídeo' : 'Carrusel'}
            </span>
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.25 }}>{idea.titulo}</h2>
          {pilarNombre && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{pilarNombre}</p>}
          {idea.gancho && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
              «{idea.gancho}»
            </p>
          )}
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Copy del carrusel
            </h3>
            <button
              onClick={generar}
              disabled={!puedeGenerar || generando}
              className="btn-primary"
              style={{ minHeight: 36, padding: '0 12px', gap: 6, fontSize: 13 }}
            >
              {generando ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <Sparkle size={14} weight="fill" />}
              {generando ? 'Generando…' : slides.length ? 'Regenerar' : 'Generar copy'}
            </button>
          </div>

          {!puedeGenerar && (
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 16 }}>
              Mueve esta idea a «En progreso» en el Kanban para generar el copy.
            </p>
          )}

          {slides.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Aún no hay copy. {puedeGenerar ? 'Pulsa «Generar copy».' : ''}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {slides.map((slide, i) => {
                const meta = SLIDE_ROLES.find((r) => r.rol === slide.rol)
                return (
                  <div key={slide.rol}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: indigo, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                        {i + 1}
                      </span>
                      {meta?.label ?? slide.rol}
                    </label>
                    <textarea
                      value={slide.texto}
                      onChange={(e) => editarSlide(i, e.target.value)}
                      rows={3}
                      style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 14, lineHeight: 1.5, resize: 'vertical', fontFamily: 'var(--font-body)' }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {slides.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={guardar} disabled={guardando || !dirty} className="btn-primary" style={{ gap: 6 }}>
              {guardando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <FloppyDisk size={15} weight="fill" />}
              {guardando ? 'Guardando…' : dirty ? 'Guardar copy' : 'Guardado'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
