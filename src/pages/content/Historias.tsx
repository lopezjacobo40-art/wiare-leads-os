import { useEffect, useState } from 'react'
import { Sparkle, Image as ImageIcon, DownloadSimple, Trash, ArrowClockwise } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { generarHistorias } from '../../lib/claudeApi'
import { renderCarrusel, descargarZip } from '../../lib/renderCarousel'
import { fetchVoiceExamples } from '../../lib/brandVoice'
import type { SlideRol } from '../../lib/contentIdeas'
import {
  fetchStories, crearStory, actualizarStory, borrarStory,
  OBJETIVOS_HISTORIA, objetivoLabel, type ContentStory, type StoryFrame,
} from '../../lib/contentStories'

const ROLES: SlideRol[] = ['hook', 'problema', 'solucion', 'cta']

/* Tarjeta de una secuencia de historias: frames editables + render vertical + ZIP. */
function StoryCard({ story, onChange }: { story: ContentStory; onChange: () => void }) {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [frames, setFrames] = useState<StoryFrame[]>(story.frames ?? [])
  const [imagenes, setImagenes] = useState(story.imagenes ?? [])
  const [dirty, setDirty] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [descargando, setDescargando] = useState(false)

  useEffect(() => { setFrames(story.frames ?? []); setImagenes(story.imagenes ?? []); setDirty(false) }, [story])

  const slidesDe = (fs: StoryFrame[]) => fs.map((f, i) => ({ rol: ROLES[i] ?? 'solucion', texto: f.texto }))

  const generarDiseno = async () => {
    if (!brand) return
    if (!frames.every((f) => f.texto.trim())) { toast('Completa todos los frames', 'error'); return }
    setRendering(true)
    try {
      const imgs = await renderCarrusel({ ideaId: story.id, slides: slidesDe(frames), brand, aspecto: '9:16' })
      setImagenes(imgs)
      await actualizarStory(story.id, { frames, imagenes: imgs })
      setDirty(false)
      toast('Historias renderizadas', 'success')
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al renderizar', 'error')
    } finally { setRendering(false) }
  }

  const regenerar = async (i: number) => {
    if (!brand) return
    setRegenIdx(i)
    try {
      const [img] = await renderCarrusel({ ideaId: story.id, slides: slidesDe(frames), brand, aspecto: '9:16', onlySlide: i })
      const nuevas = imagenes.map((im, idx) => (idx === i ? img : im))
      setImagenes(nuevas)
      await actualizarStory(story.id, { imagenes: nuevas })
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al regenerar', 'error')
    } finally { setRegenIdx(null) }
  }

  const eliminar = async () => {
    const { error } = await borrarStory(story.id)
    if (error) toast('Error al borrar', 'error')
    else onChange()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-subtle)', borderRadius: 'var(--radius-full)', padding: '3px 12px' }}>
          {objetivoLabel(story.objetivo)}
        </span>
        <button onClick={eliminar} aria-label="Borrar secuencia" className="btn-ghost" style={{ padding: 6, minHeight: 32, minWidth: 32, color: 'var(--color-text-tertiary)' }}>
          <Trash size={14} />
        </button>
      </div>

      {/* Frames editables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {frames.map((f, i) => (
          <div key={i}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>Historia {i + 1}</label>
            <textarea
              value={f.texto}
              onChange={(e) => { setFrames((prev) => prev.map((x, idx) => (idx === i ? { texto: e.target.value } : x))); setDirty(true) }}
              rows={2}
              style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 10, fontSize: 13, lineHeight: 1.4, resize: 'vertical', fontFamily: 'var(--font-body)' }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: imagenes.length ? 16 : 0 }}>
        <button onClick={generarDiseno} disabled={rendering} className="btn-primary" style={{ minHeight: 36, gap: 6, fontSize: 13 }}>
          {rendering ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <ImageIcon size={14} weight="fill" />}
          {rendering ? 'Renderizando…' : imagenes.length ? 'Regenerar todo' : 'Generar diseño'}
        </button>
        {dirty && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Cambios sin renderizar</span>}
      </div>

      {imagenes.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
            {imagenes.map((img, i) => (
              <div key={i} style={{ position: 'relative', flex: '0 0 auto', width: 120, aspectRatio: '9 / 16', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                <img src={img.url} alt={`Historia ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => regenerar(i)} disabled={regenIdx !== null} aria-label={`Regenerar historia ${i + 1}`} title="Regenerar"
                  style={{ position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {regenIdx === i ? <span className="spinner" style={{ width: 11, height: 11, borderWidth: 2 }} /> : <ArrowClockwise size={13} />}
                </button>
              </div>
            ))}
          </div>
          <button onClick={async () => { setDescargando(true); try { await descargarZip(imagenes, `historias-${story.objetivo}`) } finally { setDescargando(false) } }} disabled={descargando} className="btn-secondary" style={{ gap: 6 }}>
            {descargando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <DownloadSimple size={15} weight="bold" />}
            Descargar ZIP
          </button>
        </>
      )}
    </div>
  )
}

export default function Historias() {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [stories, setStories] = useState<ContentStory[]>([])
  const [loading, setLoading] = useState(true)
  const [objetivo, setObjetivo] = useState(OBJETIVOS_HISTORIA[0].id)
  const [generando, setGenerando] = useState(false)
  const [ejemplosTono, setEjemplosTono] = useState<string[]>([])

  const cargar = async () => {
    const [ss, ex] = await Promise.all([fetchStories(), fetchVoiceExamples()])
    setStories(ss)
    setEjemplosTono(ex.map((e) => e.texto_ejemplo))
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const generar = async () => {
    setGenerando(true)
    try {
      const frames = await generarHistorias(objetivo, brand?.tono_voz, ejemplosTono)
      const { error } = await crearStory(objetivo, frames)
      if (error) throw new Error(error)
      toast(`Secuencia generada: ${objetivoLabel(objetivo)}`, 'success')
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar', 'error')
    } finally { setGenerando(false) }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Historias"
        subtitulo="Secuencias verticales (9:16) para Stories, generadas según tu objetivo."
        acciones={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} style={{ height: 40, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14 }}>
              {OBJETIVOS_HISTORIA.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn-primary" onClick={generar} disabled={generando} style={{ minHeight: 40, gap: 6 }}>
              {generando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Sparkle size={15} weight="fill" />}
              {generando ? 'Generando…' : 'Generar historias'}
            </button>
          </div>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} /></div>
      ) : stories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          Aún no hay secuencias. Elige un objetivo y pulsa «Generar historias».
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          {stories.map((s) => <StoryCard key={s.id} story={s} onChange={cargar} />)}
        </div>
      )}
    </PageTransition>
  )
}
