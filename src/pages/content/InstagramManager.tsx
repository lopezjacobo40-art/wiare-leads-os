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
import { generarIdeasContenido } from '../../lib/claudeApi'
import {
  fetchPillars, fetchIdeas, crearIdeas, actualizarIdea,
  FORMATO_LABELS, IDEA_ESTADOS,
  type ContentIdea, type ContentPillar, type IdeaEstado, type IdeaFormato,
} from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Instagram Manager — todas las publicaciones por estado:
   Backlog → Borrador → Programado → Publicado.
   Crear a mano, generar con IA por pilar, editar metadatos
   (caption, tipo, fecha) y abrir el editor de carrusel.
   ───────────────────────────────────────────── */

const FORMATO_ICONO: Record<IdeaFormato, typeof Rows> = {
  carrusel: Rows, video: VideoCamera, reel: FilmSlate, post: ImageSquare, secuencia: Rows, historia: FrameCorners,
}

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

  const indigo = brand?.colores.indigo ?? '#6366F1'
  const cyan = brand?.colores.cyan ?? '#22D3EE'

  // Color de badge por tipo de publicación
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
    // Programado ordenado por fecha ascendente; el resto por creación desc (ya viene así)
    m.set('listo', [...(m.get('listo') ?? [])].sort((a, b) =>
      new Date(a.fecha_publicacion ?? '2999').getTime() - new Date(b.fecha_publicacion ?? '2999').getTime()
    ))
    return m
  }, [ideas])

  const visibles = porEstado.get(tab) ?? []

  const generar = async () => {
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
      setTab('idea')
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando ideas', 'error')
    } finally {
      setGenerando(false)
    }
  }

  // Avanza al siguiente estado. Backlog→Borrador→Programado (exige fecha)→Publicado.
  const avanzar = async (idea: ContentIdea) => {
    const orden: IdeaEstado[] = ['idea', 'en_progreso', 'listo', 'publicado']
    const siguiente = orden[orden.indexOf(idea.estado) + 1]
    if (!siguiente) return
    if (siguiente === 'listo' && !idea.fecha_publicacion) {
      // Programar exige fecha → abre el editor
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

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Instagram Manager" subtitulo="Publicaciones por estado: backlog, borradores, programadas y publicadas" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Instagram Manager"
        subtitulo="Publicaciones por estado: backlog, borradores, programadas y publicadas"
        acciones={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {pillars.length > 0 && (
              <>
                <select
                  value={pilarSel}
                  onChange={(e) => setPilarSel(e.target.value)}
                  aria-label="Pilar para generar ideas"
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: '#fff', maxWidth: 180 }}
                >
                  {pillars.map((p) => <option key={p.id} value={p.id}>{p.nombre_pilar}</option>)}
                </select>
                <button className="btn-secondary" onClick={generar} disabled={generando} style={{ fontSize: 13 }}>
                  {generando
                    ? <><ArrowsClockwise size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Generando…</>
                    : <><Sparkle size={14} /> Generar ideas</>}
                </button>
              </>
            )}
            <button className="btn-primary" onClick={() => { setEditando(null); setDialogAbierto(true) }} style={{ fontSize: 13 }}>
              <Plus size={14} /> Nueva publicación
            </button>
          </div>
        }
      />

      {/* Tabs por estado */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {IDEA_ESTADOS.map((e) => {
          const activo = tab === e.id
          const n = porEstado.get(e.id)?.length ?? 0
          return (
            <button
              key={e.id}
              onClick={() => setTab(e.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                minHeight: 'auto',
                background: activo ? 'var(--color-primary-subtle)' : 'transparent',
                color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {e.label}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* Grid de publicaciones */}
      {visibles.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
          Nada en {IDEA_ESTADOS.find((e) => e.id === tab)?.label.toLowerCase()} todavía
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {visibles.map((idea) => {
            const c = colorFormato(idea.formato)
            const Icono = FORMATO_ICONO[idea.formato] ?? ImageSquare
            const pilarNombre = pillars.find((p) => p.id === idea.pilar_id)?.nombre_pilar
            return (
              <div
                key={idea.id}
                className="card"
                style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, color: c,
                    background: `color-mix(in srgb, ${c} 10%, transparent)`,
                    borderRadius: 'var(--radius-full)', padding: '3px 10px',
                  }}>
                    <Icono size={12} weight="fill" /> {FORMATO_LABELS[idea.formato]}
                  </span>
                  {idea.origen === 'replicada' && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Replicada
                    </span>
                  )}
                </div>

                <button
                  onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                  aria-label={`Editar ${idea.titulo}`}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>
                    {idea.titulo}
                  </span>
                  {(idea.caption || idea.gancho) && (
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.4,
                    }}>
                      {idea.caption || idea.gancho}
                    </span>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
                  {idea.fecha_publicacion && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CalendarBlank size={12} /> {fechaCorta(idea.fecha_publicacion)}
                    </span>
                  )}
                  {pilarNombre && <span>· {pilarNombre}</span>}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                    style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }}
                  >
                    <PencilSimple size={13} /> Editar
                  </button>
                  {idea.formato === 'carrusel' && (
                    <button
                      className="btn-ghost"
                      onClick={() => setDrawerIdea(idea)}
                      style={{ fontSize: 12, padding: '4px 10px', minHeight: 30, color: indigo }}
                    >
                      <Rows size={13} /> Carrusel
                    </button>
                  )}
                  {idea.estado !== 'publicado' && (
                    <button
                      className="btn-ghost"
                      onClick={() => avanzar(idea)}
                      disabled={avanzandoId === idea.id}
                      style={{ fontSize: 12, padding: '4px 10px', minHeight: 30, marginLeft: 'auto', color: 'var(--color-primary)' }}
                      title={`Pasar a ${IDEA_ESTADOS[['idea', 'en_progreso', 'listo', 'publicado'].indexOf(idea.estado) + 1]?.label ?? ''}`}
                    >
                      {IDEA_ESTADOS[['idea', 'en_progreso', 'listo', 'publicado'].indexOf(idea.estado) + 1]?.label} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
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
