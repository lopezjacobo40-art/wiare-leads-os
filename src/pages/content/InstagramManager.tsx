import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Sparkle, ArrowRight, PencilSimple, Rows, VideoCamera,
  FilmSlate, ImageSquare, FrameCorners, CalendarBlank, ArrowsClockwise,
} from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import IdeaDrawer from '../../components/content/IdeaDrawer'
import IdeaEditDialog from '../../components/content/IdeaEditDialog'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { fetchVoiceExamples } from '../../lib/brandVoice'
import { generarIdeasContenido, generarCaption } from '../../lib/claudeApi'
import { getProveedorIA, setProveedorIA, PROVEEDORES_IA, type ProveedorIA } from '../../lib/iaProvider'
import {
  fetchPillars, fetchIdeas, crearIdeas, actualizarIdea,
  FORMATO_LABELS, IDEA_ESTADOS,
  type ContentIdea, type ContentPillar, type IdeaEstado, type IdeaFormato,
} from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Instagram Manager — cards visuales por estado:
   Backlog → Borrador → Programado → Publicado.
   Cada card genera su contenido in situ (caption con IA; los
   carruseles abren su editor de 5 slides) con motor a elegir:
   Claude (calidad) o Gemini (~3× más barato).
   ───────────────────────────────────────────── */

const FORMATO_ICONO: Record<IdeaFormato, typeof Rows> = {
  carrusel: Rows, video: VideoCamera, reel: FilmSlate, post: ImageSquare, secuencia: Rows, historia: FrameCorners,
}

const ORDEN_ESTADOS: IdeaEstado[] = ['idea', 'en_progreso', 'listo', 'publicado']

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function InstagramManager() {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [ejemplosTono, setEjemplosTono] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<IdeaEstado>('idea')
  const [editando, setEditando] = useState<ContentIdea | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [drawerIdea, setDrawerIdea] = useState<ContentIdea | null>(null)
  const [generando, setGenerando] = useState(false)
  const [pilarSel, setPilarSel] = useState('')
  const [avanzandoId, setAvanzandoId] = useState<string | null>(null)
  const [captionId, setCaptionId] = useState<string | null>(null)
  const [proveedor, setProveedor] = useState<ProveedorIA>(() => getProveedorIA())

  const indigo = brand?.colores.indigo ?? '#6366F1'
  const cyan = brand?.colores.cyan ?? '#22D3EE'

  const colorFormato = (f: IdeaFormato): string => {
    if (f === 'carrusel' || f === 'secuencia') return indigo
    if (f === 'reel' || f === 'video') return cyan
    if (f === 'historia') return '#8B5CF6'
    return '#71717A'
  }

  const cargar = async () => {
    const [ps, is, ex] = await Promise.all([fetchPillars(), fetchIdeas(), fetchVoiceExamples()])
    setPillars(ps)
    setIdeas(is)
    setEjemplosTono(ex.map((e) => e.texto_ejemplo))
    setPilarSel((prev) => prev || (ps[0]?.id ?? ''))
    setDrawerIdea((prev) => (prev ? is.find((i) => i.id === prev.id) ?? null : null))
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const porEstado = useMemo(() => {
    const m = new Map<IdeaEstado, ContentIdea[]>()
    for (const e of IDEA_ESTADOS) m.set(e.id, [])
    for (const i of ideas) m.get(i.estado)?.push(i)
    m.set('listo', [...(m.get('listo') ?? [])].sort((a, b) =>
      new Date(a.fecha_publicacion ?? '2999').getTime() - new Date(b.fecha_publicacion ?? '2999').getTime()
    ))
    return m
  }, [ideas])

  const visibles = porEstado.get(tab) ?? []

  const elegirProveedor = (p: ProveedorIA) => {
    setProveedorIA(p)
    setProveedor(p)
  }

  const generarIdeas = async () => {
    const pilar = pillars.find((p) => p.id === pilarSel)
    if (!pilar) { toast('Elige un pilar primero', 'error'); return }
    setGenerando(true)
    try {
      const nuevas = await generarIdeasContenido(pilar, brand?.tono_voz)
      const { error } = await crearIdeas(nuevas.map((n) => ({
        pilar_id: pilar.id, titulo: n.titulo, gancho: n.gancho, formato: n.formato as IdeaFormato,
      })))
      if (error) throw new Error(error)
      toast(`${nuevas.length} ideas nuevas en el backlog`, 'success')
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando ideas', 'error')
    } finally {
      setGenerando(false)
    }
  }

  // Generar contenido desde la card: carrusel → editor de slides; resto → caption in situ
  const generarContenido = async (idea: ContentIdea) => {
    if (idea.formato === 'carrusel') {
      setDrawerIdea(idea)
      return
    }
    setCaptionId(idea.id)
    try {
      const r = await generarCaption(
        {
          titulo: idea.titulo,
          gancho: idea.gancho,
          formato: FORMATO_LABELS[idea.formato],
          pilar: pillars.find((p) => p.id === idea.pilar_id)?.nombre_pilar,
        },
        ejemplosTono,
        brand?.tono_voz,
        proveedor
      )
      const { error } = await actualizarIdea(idea.id, { caption: r.caption, gancho: r.gancho || idea.gancho })
      if (error) throw new Error(error)
      toast(`Caption generado con ${proveedor === 'gemini' ? 'Gemini' : 'Claude'}`, 'success')
      cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando el caption', 'error')
    } finally {
      setCaptionId(null)
    }
  }

  const avanzar = async (idea: ContentIdea) => {
    const siguiente = ORDEN_ESTADOS[ORDEN_ESTADOS.indexOf(idea.estado) + 1]
    if (!siguiente) return
    if (siguiente === 'listo' && !idea.fecha_publicacion) {
      setEditando(idea)
      setDialogAbierto(true)
      toast('Ponle fecha de publicación para programarla', 'info')
      return
    }
    setAvanzandoId(idea.id)
    const { error } = await actualizarIdea(idea.id, { estado: siguiente })
    setAvanzandoId(null)
    if (error) { toast(error, 'error'); return }
    toast(`→ ${IDEA_ESTADOS.find((e) => e.id === siguiente)?.label}`, 'success')
    cargar()
  }

  const siguienteLabel = (estado: IdeaEstado): string | null => {
    const sig = ORDEN_ESTADOS[ORDEN_ESTADOS.indexOf(estado) + 1]
    return sig ? IDEA_ESTADOS.find((e) => e.id === sig)?.label ?? null : null
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Instagram Manager" subtitulo="Backlog, borradores, programadas y publicadas" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Instagram Manager"
        subtitulo="Backlog, borradores, programadas y publicadas"
        acciones={
          <button className="btn-primary" onClick={() => { setEditando(null); setDialogAbierto(true) }} style={{ fontSize: 13, minHeight: 36 }}>
            <Plus size={14} /> Nueva publicación
          </button>
        }
      />

      {/* Toolbar: tabs de estado + motor IA + generación por pilar (solo Backlog) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {IDEA_ESTADOS.map((e) => {
            const activo = tab === e.id
            const n = porEstado.get(e.id)?.length ?? 0
            return (
              <button
                key={e.id}
                onClick={() => setTab(e.id)}
                aria-pressed={activo}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 13,
                  fontWeight: activo ? 600 : 500,
                  border: 'none',
                  minHeight: 'auto',
                  background: activo ? 'var(--color-primary-subtle)' : 'transparent',
                  color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {e.label}
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.65, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Motor de generación */}
          <div
            role="radiogroup"
            aria-label="Motor de IA"
            style={{ display: 'inline-flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: 2, background: '#fff' }}
          >
            {PROVEEDORES_IA.map((p) => {
              const activo = proveedor === p.id
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirProveedor(p.id)}
                  title={p.nota}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    minHeight: 26,
                    background: activo ? 'var(--color-primary)' : 'transparent',
                    color: activo ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {tab === 'idea' && pillars.length > 0 && (
            <>
              <select
                value={pilarSel}
                onChange={(e) => setPilarSel(e.target.value)}
                aria-label="Pilar para generar ideas"
                style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: '#fff', color: 'var(--color-text-primary)', maxWidth: 170, minHeight: 32 }}
              >
                {pillars.map((p) => <option key={p.id} value={p.id}>{p.nombre_pilar}</option>)}
              </select>
              <button className="btn-secondary" onClick={generarIdeas} disabled={generando} style={{ fontSize: 12, padding: '6px 12px', minHeight: 32 }}>
                {generando
                  ? <><ArrowsClockwise size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generando…</>
                  : <><Sparkle size={13} /> Generar ideas</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      {visibles.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
            Nada en {IDEA_ESTADOS.find((e) => e.id === tab)?.label.toLowerCase()}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {tab === 'idea' && 'Genera ideas con IA desde un pilar o crea una publicación a mano.'}
            {tab === 'en_progreso' && 'Pasa ideas del backlog a borrador cuando empieces a trabajarlas.'}
            {tab === 'listo' && 'Un borrador con fecha de publicación pasa aquí al programarlo.'}
            {tab === 'publicado' && 'Cuando publiques en Instagram, marca la pieza como publicada.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {visibles.map((idea) => {
            const c = colorFormato(idea.formato)
            const Icono = FORMATO_ICONO[idea.formato] ?? ImageSquare
            const pilarNombre = pillars.find((p) => p.id === idea.pilar_id)?.nombre_pilar
            const sigLabel = siguienteLabel(idea.estado)
            const portada = idea.imagenes?.[0]?.url ?? null
            const generandoEsta = captionId === idea.id
            return (
              <article
                key={idea.id}
                className="card"
                style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 200ms cubic-bezier(0.4,0,0.2,1)' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
              >
                {/* Portada: primer slide renderizado, o placeholder tipográfico del formato */}
                <button
                  onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                  aria-label={`Editar ${idea.titulo}`}
                  style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '5 / 3', border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', background: portada ? '#09090B' : `color-mix(in srgb, ${c} 7%, var(--color-surface))` }}
                >
                  {portada ? (
                    <img src={portada} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icono size={40} weight="duotone" color={c} />
                    </span>
                  )}
                  {/* Chips sobre la portada */}
                  <span style={{
                    position: 'absolute', top: 10, left: 10,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, color: c,
                    background: 'rgba(255,255,255,0.92)',
                    borderRadius: 'var(--radius-full)', padding: '3px 10px',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <Icono size={12} weight="fill" /> {FORMATO_LABELS[idea.formato]}
                  </span>
                  {idea.fecha_publicacion && (
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)',
                      background: 'rgba(255,255,255,0.92)',
                      borderRadius: 'var(--radius-full)', padding: '3px 10px',
                      boxShadow: 'var(--shadow-sm)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      <CalendarBlank size={12} weight="fill" color={cyan} /> {fechaCorta(idea.fecha_publicacion)}
                    </span>
                  )}
                </button>

                {/* Cuerpo */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {idea.titulo}
                  </h3>
                  {(idea.caption || idea.gancho) ? (
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {idea.caption || idea.gancho}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                      Sin contenido aún — genera el caption con IA
                    </p>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 'auto' }}>
                    {pilarNombre}{idea.origen === 'replicada' && (pilarNombre ? ' · replicada' : 'replicada')}
                  </span>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    className={idea.caption || idea.copy_slides?.length ? 'btn-secondary' : 'btn-primary'}
                    onClick={() => generarContenido(idea)}
                    disabled={generandoEsta}
                    title={idea.formato === 'carrusel'
                      ? 'Abrir el editor de carrusel (copy de 5 slides + diseño)'
                      : `Generar caption con ${proveedor === 'gemini' ? 'Gemini' : 'Claude'}`}
                    style={{ fontSize: 12, padding: '5px 12px', minHeight: 32 }}
                  >
                    {generandoEsta
                      ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generando…</>
                      : <><Sparkle size={13} weight="fill" /> {idea.formato === 'carrusel' ? 'Carrusel' : idea.caption ? 'Regenerar' : 'Generar'}</>}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                    aria-label={`Editar ${idea.titulo}`}
                    title="Editar"
                    style={{ padding: 6, minHeight: 32, minWidth: 32 }}
                  >
                    <PencilSimple size={14} />
                  </button>
                  {sigLabel && (
                    <button
                      className="btn-ghost"
                      onClick={() => avanzar(idea)}
                      disabled={avanzandoId === idea.id}
                      aria-label={`Pasar ${idea.titulo} a ${sigLabel}`}
                      title={`Pasar a ${sigLabel}`}
                      style={{ padding: 6, minHeight: 32, minWidth: 32, marginLeft: 'auto', color: 'var(--color-primary)' }}
                    >
                      <ArrowRight size={14} weight="bold" />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {dialogAbierto && (
        <IdeaEditDialog
          idea={editando}
          pillars={pillars}
          onClose={() => setDialogAbierto(false)}
          onSaved={cargar}
        />
      )}

      {drawerIdea && (
        <IdeaDrawer
          idea={drawerIdea}
          pilarNombre={pillars.find((p) => p.id === drawerIdea.pilar_id)?.nombre_pilar}
          ejemplosTono={ejemplosTono}
          onClose={() => setDrawerIdea(null)}
          onSaved={cargar}
        />
      )}
    </PageTransition>
  )
}
