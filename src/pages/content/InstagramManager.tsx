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
   Instagram Manager — publicaciones por estado:
   Backlog → Borrador → Programado → Publicado.
   Lista densa con una acción primaria (Nueva publicación);
   la generación IA vive contextualmente en el Backlog.
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
    // Programado por fecha ascendente (lo más próximo arriba)
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
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando ideas', 'error')
    } finally {
      setGenerando(false)
    }
  }

  // Avanza al siguiente estado. Programar exige fecha → abre el editor.
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
        <Skeleton.Line width={320} height={32} style={{ marginBottom: 16 }} />
        <Skeleton.Rect width="100%" height={380} radius={14} />
      </PageTransition>
    )
  }

  const iconBtn: React.CSSProperties = { padding: 6, minHeight: 30, minWidth: 30 }

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

      {/* Toolbar: tabs de estado + generación IA contextual (solo Backlog) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
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

        {tab === 'idea' && pillars.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={pilarSel}
              onChange={(e) => setPilarSel(e.target.value)}
              aria-label="Pilar para generar ideas"
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: '#fff', color: 'var(--color-text-primary)', maxWidth: 180, minHeight: 32 }}
            >
              {pillars.map((p) => <option key={p.id} value={p.id}>{p.nombre_pilar}</option>)}
            </select>
            <button className="btn-secondary" onClick={generar} disabled={generando} style={{ fontSize: 12, padding: '6px 12px', minHeight: 32 }}>
              {generando
                ? <><ArrowsClockwise size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generando…</>
                : <><Sparkle size={13} /> Generar ideas</>}
            </button>
          </div>
        )}
      </div>

      {/* Lista de publicaciones */}
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
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {visibles.map((idea, idx) => {
            const c = colorFormato(idea.formato)
            const Icono = FORMATO_ICONO[idea.formato] ?? ImageSquare
            const pilarNombre = pillars.find((p) => p.id === idea.pilar_id)?.nombre_pilar
            const sigLabel = siguienteLabel(idea.estado)
            return (
              <div
                key={idea.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                  transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Tipo */}
                <span
                  title={FORMATO_LABELS[idea.formato]}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in srgb, ${c} 10%, transparent)`,
                    color: c, flexShrink: 0,
                  }}
                >
                  <Icono size={14} weight="fill" />
                </span>

                {/* Título + meta */}
                <button
                  onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                  aria-label={`Editar ${idea.titulo}`}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idea.titulo}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {FORMATO_LABELS[idea.formato]}
                    {pilarNombre && <> · {pilarNombre}</>}
                    {idea.origen === 'replicada' && <> · replicada</>}
                    {(idea.caption || idea.gancho) && <> — {idea.caption || idea.gancho}</>}
                  </span>
                </button>

                {/* Fecha programada */}
                {idea.fecha_publicacion && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                    fontSize: 11.5, fontWeight: 600, color: cyan, fontVariantNumeric: 'tabular-nums',
                  }}>
                    <CalendarBlank size={12} weight="fill" /> {fechaCorta(idea.fecha_publicacion)}
                  </span>
                )}

                {/* Acciones */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => { setEditando(idea); setDialogAbierto(true) }}
                    aria-label={`Editar ${idea.titulo}`}
                    title="Editar"
                    style={iconBtn}
                  >
                    <PencilSimple size={14} />
                  </button>
                  {idea.formato === 'carrusel' && (
                    <button
                      className="btn-ghost"
                      onClick={() => setDrawerIdea(idea)}
                      aria-label={`Editor de carrusel de ${idea.titulo}`}
                      title="Editor de carrusel"
                      style={{ ...iconBtn, color: indigo }}
                    >
                      <Rows size={14} />
                    </button>
                  )}
                  {sigLabel && (
                    <button
                      className="btn-ghost"
                      onClick={() => avanzar(idea)}
                      disabled={avanzandoId === idea.id}
                      aria-label={`Pasar ${idea.titulo} a ${sigLabel}`}
                      title={`Pasar a ${sigLabel}`}
                      style={{ ...iconBtn, color: 'var(--color-primary)' }}
                    >
                      <ArrowRight size={14} weight="bold" />
                    </button>
                  )}
                </span>
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
