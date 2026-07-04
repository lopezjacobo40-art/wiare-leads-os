import { useEffect, useState } from 'react'
import { X, Sparkle, FloppyDisk, Rows, VideoCamera, FilmSlate, ImageSquare, FrameCorners, ArrowRight, Image as ImageIcon, ArrowClockwise, DownloadSimple } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../Toast'
import { useBrandKit } from '../../lib/brandKit'
import { generarCopyCarrusel } from '../../lib/claudeApi'
import { renderCarrusel, descargarZip } from '../../lib/renderCarousel'
import { FORMATOS, FORMATO_DEFAULT, type FormatoKey } from '../../lib/formatos'
import { actualizarIdea, SLIDE_ROLES, FORMATO_LABELS, type ContentIdea, type CopySlide, type CarruselImagen, type IdeaFormato } from '../../lib/contentIdeas'

const FORMATO_ICONO: Record<IdeaFormato, typeof Rows> = { carrusel: Rows, video: VideoCamera, reel: FilmSlate, post: ImageSquare, secuencia: FrameCorners }

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
  const navigate = useNavigate()
  const { brand } = useBrandKit()
  const indigo = brand?.colores.indigo ?? '#6366F1'

  const [slides, setSlides] = useState<CopySlide[]>([])
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [imagenes, setImagenes] = useState<CarruselImagen[]>([])
  const [generandoDiseno, setGenerandoDiseno] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [aspecto, setAspecto] = useState<FormatoKey>(FORMATO_DEFAULT)

  useEffect(() => {
    setSlides(idea.copy_slides ?? [])
    setImagenes(idea.imagenes ?? [])
    setAspecto((idea.aspecto as FormatoKey) in FORMATOS ? (idea.aspecto as FormatoKey) : FORMATO_DEFAULT)
    setDirty(false)
  }, [idea])

  const esCarrusel = idea.formato === 'carrusel'
  const copyCompleto = slides.length === 5 && slides.every((s) => s.texto.trim())

  const generarDiseno = async () => {
    if (!brand) return
    if (!copyCompleto) { toast('Completa y guarda el copy de los 5 slides primero', 'error'); return }
    setGenerandoDiseno(true)
    try {
      const imgs = await renderCarrusel({ ideaId: idea.id, slides, brand, aspecto })
      setImagenes(imgs)
      // Persiste copy + imágenes + formato juntos
      await actualizarIdea(idea.id, { copy_slides: slides, imagenes: imgs, aspecto })
      setDirty(false)
      toast('Carrusel renderizado', 'success')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al renderizar', 'error')
    } finally {
      setGenerandoDiseno(false)
    }
  }

  const regenerarSlide = async (i: number) => {
    if (!brand) return
    setRegenIdx(i)
    try {
      const [img] = await renderCarrusel({ ideaId: idea.id, slides, brand, onlySlide: i, aspecto })
      const nuevas = imagenes.map((im, idx) => (idx === i ? img : im))
      setImagenes(nuevas)
      await actualizarIdea(idea.id, { imagenes: nuevas })
      toast(`Slide ${i + 1} regenerado`, 'success')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al regenerar', 'error')
    } finally {
      setRegenIdx(null)
    }
  }

  const descargar = async () => {
    setDescargando(true)
    try {
      await descargarZip(imagenes, idea.titulo)
    } catch {
      toast('Error al preparar el ZIP', 'error')
    } finally {
      setDescargando(false)
    }
  }

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
              {(() => { const I = FORMATO_ICONO[idea.formato as IdeaFormato] ?? Rows; return <I size={12} weight="fill" /> })()}
              {idea.semana != null ? `${idea.semana === 0 ? 'Base' : `S${idea.semana}`} · ` : ''}{FORMATO_LABELS[idea.formato as IdeaFormato] ?? idea.formato}
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
          {!esCarrusel ? (
            idea.formato === 'secuencia' ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 14 }}>
                  Esta es una <strong>secuencia de Historias</strong> del calendario. {idea.gancho ? idea.gancho.replace('Objetivo:', 'Su objetivo es') + '.' : ''} Genérala y renderízala (9:16) en la página de Historias.
                </p>
                <button className="btn-primary" onClick={() => navigate('/content/historias')} style={{ gap: 6 }}>
                  Ir a Historias <ArrowRight size={15} weight="bold" />
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}>
                  Este ítem del calendario es un <strong>{(FORMATO_LABELS[idea.formato as IdeaFormato] ?? idea.formato).toLowerCase()}</strong>. El generador crea carruseles; este formato lo produces por tu cuenta (grabas el reel / diseñas el post).
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  Usa el gancho de arriba como punto de partida. Cuando esté publicado, arrástralo a «Publicado» en el tablero.
                </p>
              </div>
            )
          ) : (<>
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

          {/* ── Diseño del carrusel ── */}
          {slides.length > 0 && (
            <div style={{ marginTop: 32, borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Diseño
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={aspecto}
                    onChange={(e) => setAspecto(e.target.value as FormatoKey)}
                    aria-label="Relación de aspecto"
                    style={{ height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 10px', fontSize: 13 }}
                  >
                    {(Object.keys(FORMATOS) as FormatoKey[]).map((k) => (
                      <option key={k} value={k}>{FORMATOS[k].label}</option>
                    ))}
                  </select>
                  <button onClick={generarDiseno} disabled={generandoDiseno || !copyCompleto} className="btn-primary" style={{ minHeight: 36, padding: '0 12px', gap: 6, fontSize: 13 }}>
                    {generandoDiseno ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <ImageIcon size={14} weight="fill" />}
                    {generandoDiseno ? 'Renderizando…' : imagenes.length ? 'Regenerar todo' : 'Generar diseño'}
                  </button>
                </div>
              </div>

              {imagenes.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                  {copyCompleto ? 'Pulsa «Generar diseño» para renderizar los 5 slides.' : 'Genera y guarda el copy de los 5 slides para poder diseñar.'}
                </p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    {imagenes.map((img, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', aspectRatio: `${FORMATOS[aspecto].w} / ${FORMATOS[aspecto].h}`, background: 'var(--color-surface-2)' }}>
                        <img src={img.url} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={() => regenerarSlide(i)}
                          disabled={regenIdx !== null}
                          aria-label={`Regenerar slide ${i + 1}`}
                          title="Regenerar este slide"
                          style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                        >
                          {regenIdx === i ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <ArrowClockwise size={14} />}
                        </button>
                        <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button onClick={descargar} disabled={descargando} className="btn-secondary" style={{ width: '100%', gap: 6 }}>
                    {descargando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <DownloadSimple size={15} weight="bold" />}
                    {descargando ? 'Preparando ZIP…' : 'Descargar ZIP'}
                  </button>
                </>
              )}
            </div>
          )}
          </>)}
        </div>

        {/* Footer */}
        {esCarrusel && slides.length > 0 && (
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
