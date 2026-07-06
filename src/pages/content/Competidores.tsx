import { useEffect, useMemo, useState } from 'react'
import {
  Plus, ArrowsClockwise, TrendUp, TrendDown, CaretUp, CaretDown,
  Trash, ArrowSquareOut, Sparkle, X, Binoculars,
} from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { fetchVoiceExamples } from '../../lib/brandVoice'
import { replicarIdeaCompetidor, type IdeaReplicada } from '../../lib/claudeApi'
import { crearIdea } from '../../lib/contentIdeas'
import {
  fetchCompetitors, fetchCompetitorPosts, addCompetitor, deleteCompetitor, scrapeCompetitor,
  type CompetitorConMetricas, type CompetitorPost,
} from '../../lib/competitors'

/* ─────────────────────────────────────────────
   Seguimiento de competidores en Instagram.
   Tabla ordenable con followers, tendencias (Δ7d/Δ30d) y engagement.
   Detalle por competidor: últimos posts públicos + "Replicar" →
   genera una idea propia con la voz de WIARE y la manda al backlog.
   ───────────────────────────────────────────── */

type ColumnaOrden = 'username' | 'followers' | 'delta_7d' | 'delta_30d' | 'engagement_rate'

function num(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-ES')
}

function Delta({ valor }: { valor: number | null }) {
  if (valor == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
  const positivo = valor > 0
  const color = valor === 0 ? 'var(--color-text-tertiary)' : positivo ? 'var(--color-success)' : 'var(--color-error)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontVariantNumeric: 'tabular-nums' }}>
      {valor !== 0 && (positivo ? <TrendUp size={13} weight="bold" /> : <TrendDown size={13} weight="bold" />)}
      {positivo ? '+' : ''}{valor.toLocaleString('es-ES')}
    </span>
  )
}

export default function Competidores() {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [comps, setComps] = useState<CompetitorConMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<ColumnaOrden>('followers')
  const [asc, setAsc] = useState(false)
  const [dialogAdd, setDialogAdd] = useState(false)
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [anadiendo, setAnadiendo] = useState(false)
  const [refrescandoId, setRefrescandoId] = useState<string | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<CompetitorConMetricas | null>(null)
  const [posts, setPosts] = useState<CompetitorPost[]>([])
  const [cargandoPosts, setCargandoPosts] = useState(false)
  const [replicando, setReplicando] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ post: CompetitorPost; idea: IdeaReplicada } | null>(null)
  const [guardandoReplica, setGuardandoReplica] = useState(false)

  const cargar = async () => {
    setComps(await fetchCompetitors())
    setLoading(false)
  }
   
  useEffect(() => { cargar() }, [])

  const ordenados = useMemo(() => {
    const lista = [...comps]
    lista.sort((a, b) => {
      const va = a[orden]; const vb = b[orden]
      if (typeof va === 'string' && typeof vb === 'string') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const na = (va as number | null) ?? -Infinity
      const nb = (vb as number | null) ?? -Infinity
      return asc ? na - nb : nb - na
    })
    return lista
  }, [comps, orden, asc])

  const ordenarPor = (col: ColumnaOrden) => {
    if (orden === col) setAsc(!asc)
    else { setOrden(col); setAsc(col === 'username') }
  }

  const anadir = async () => {
    if (!nuevoUsername.trim()) return
    setAnadiendo(true)
    const { error, id } = await addCompetitor(nuevoUsername)
    setAnadiendo(false)
    if (error) { toast(error, 'error'); return }
    toast(`@${nuevoUsername.replace(/^@/, '')} en seguimiento — refrescando datos…`, 'success')
    setNuevoUsername('')
    setDialogAdd(false)
    await cargar()
    // Primer scrape automático al añadir
    const comp = (await fetchCompetitors()).find((c) => c.id === id)
    if (comp) refrescar(comp)
  }

  const refrescar = async (comp: CompetitorConMetricas) => {
    setRefrescandoId(comp.id)
    const r = await scrapeCompetitor(comp)
    setRefrescandoId(null)
    if (r.error) { toast(r.error, 'error'); return }
    toast(`@${comp.username}: ${num(r.followers ?? null)} followers · ${r.posts} posts recientes`, 'success')
    cargar()
    if (abierto?.id === comp.id) abrirDetalle(comp)
  }

  const borrar = async (comp: CompetitorConMetricas) => {
    if (borrandoId !== comp.id) { setBorrandoId(comp.id); return }
    const { error } = await deleteCompetitor(comp.id)
    setBorrandoId(null)
    if (error) { toast(error, 'error'); return }
    if (abierto?.id === comp.id) setAbierto(null)
    toast(`@${comp.username} eliminado del seguimiento`, 'success')
    cargar()
  }

  const abrirDetalle = async (comp: CompetitorConMetricas) => {
    setAbierto(comp)
    setCargandoPosts(true)
    setPosts(await fetchCompetitorPosts(comp.id))
    setCargandoPosts(false)
  }

  const replicar = async (post: CompetitorPost) => {
    if (!abierto) return
    setReplicando(post.id)
    try {
      const ejemplos = (await fetchVoiceExamples()).map((e) => e.texto_ejemplo)
      const idea = await replicarIdeaCompetidor(
        { caption: post.caption, tipo: post.tipo, likes: post.likes, comments: post.comments, username: abierto.username },
        ejemplos,
        brand?.tono_voz
      )
      setPreview({ post, idea })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error replicando la idea', 'error')
    } finally {
      setReplicando(null)
    }
  }

  const guardarReplica = async () => {
    if (!preview) return
    setGuardandoReplica(true)
    const { error } = await crearIdea({
      titulo: preview.idea.titulo,
      gancho: preview.idea.gancho,
      caption: preview.idea.caption,
      formato: preview.idea.formato,
      estado: 'idea',
      origen: 'replicada',
      competitor_post_id: preview.post.id,
    })
    setGuardandoReplica(false)
    if (error) { toast(error, 'error'); return }
    toast('Idea añadida al backlog del Instagram Manager', 'success')
    setPreview(null)
  }

  const th = (col: ColumnaOrden, label: string, right = false): React.ReactNode => (
    <th
      onClick={() => ordenarPor(col)}
      style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: orden === col ? 'var(--color-primary)' : 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} {orden === col && (asc ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />)}
    </th>
  )

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Competidores" subtitulo="Seguimiento de perfiles de Instagram: crecimiento, engagement y contenido que funciona" />
        <Skeleton.Rect width="100%" height={320} radius={14} />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Competidores"
        subtitulo="Seguimiento de perfiles de Instagram: crecimiento, engagement y contenido que funciona"
        acciones={
          <button className="btn-primary" onClick={() => setDialogAdd(true)} style={{ fontSize: 13 }}>
            <Plus size={14} /> Añadir competidor
          </button>
        }
      />

      {comps.length === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState
            icon={Binoculars}
            titulo="Sin competidores en seguimiento"
            descripcion="Añade perfiles de Instagram de tu competencia para ver su crecimiento, su engagement y replicar el contenido que les funciona."
            accion={{ label: 'Añadir el primero →', onClick: () => setDialogAdd(true) }}
          />
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  {th('username', 'Perfil')}
                  {th('followers', 'Followers', true)}
                  {th('delta_7d', 'Δ 7d', true)}
                  {th('delta_30d', 'Δ 30d', true)}
                  {th('engagement_rate', 'Engagement', true)}
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Último refresh</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {ordenados.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--color-border)', background: abierto?.id === c.id ? 'var(--color-primary-subtle)' : undefined }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => abrirDetalle(c)}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                        aria-label={`Ver posts de @${c.username}`}
                      >
                        <span style={{ display: 'block', fontWeight: 600, color: 'var(--color-text-primary)' }}>@{c.username}</span>
                        {c.nombre && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{c.nombre}</span>}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{num(c.followers)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}><Delta valor={c.delta_7d} /></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}><Delta valor={c.delta_30d} /></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {c.engagement_rate != null ? `${c.engagement_rate}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {c.ultimo_scrape ? new Date(c.ultimo_scrape).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Nunca'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn-ghost"
                        onClick={() => refrescar(c)}
                        disabled={refrescandoId === c.id}
                        aria-label={`Refrescar @${c.username}`}
                        title="Refrescar datos (Apify)"
                        style={{ padding: 6, minHeight: 30, minWidth: 30 }}
                      >
                        <ArrowsClockwise size={14} style={refrescandoId === c.id ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => borrar(c)}
                        aria-label={`Eliminar @${c.username}`}
                        title={borrandoId === c.id ? 'Click de nuevo para confirmar' : 'Eliminar'}
                        style={{ padding: 6, minHeight: 30, minWidth: 30, color: borrandoId === c.id ? 'var(--color-error)' : undefined }}
                      >
                        <Trash size={14} weight={borrandoId === c.id ? 'fill' : 'regular'} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle: posts recientes del competidor */}
      {abierto && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              Posts recientes de @{abierto.username}
            </h2>
            <button className="btn-ghost" onClick={() => setAbierto(null)} style={{ fontSize: 12, padding: '4px 10px' }}>
              <X size={13} /> Cerrar
            </button>
          </div>

          {cargandoPosts ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton.Card key={i} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="card" style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              Sin posts guardados — pulsa refrescar en la tabla para traerlos
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {posts.map((p) => (
                <div key={p.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span>{p.tipo ?? 'Post'}{p.publicado_en ? ` · ${new Date(p.publicado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{num(p.likes)} likes · {num(p.comments)} coment.</span>
                  </div>
                  <p style={{
                    fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-text-primary)',
                    display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    whiteSpace: 'pre-line',
                  }}>
                    {p.caption || '(sin caption)'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => replicar(p)}
                      disabled={replicando === p.id || !p.caption}
                      title={p.caption ? 'Generar idea propia a partir de este post' : 'Sin caption que replicar'}
                      style={{ fontSize: 12, padding: '5px 10px', minHeight: 30 }}
                    >
                      <Sparkle size={13} /> {replicando === p.id ? 'Generando…' : 'Replicar'}
                    </button>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '5px 10px', minHeight: 30, marginLeft: 'auto' }}
                      >
                        Ver en IG <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog añadir competidor */}
      {dialogAdd && (
        <>
          <div onClick={() => setDialogAdd(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.4)', zIndex: 60 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Añadir competidor"
            style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(400px, calc(100vw - 32px))', background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 61, padding: 24 }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: 14 }}>Añadir competidor</h2>
            <input
              autoFocus
              value={nuevoUsername}
              onChange={(e) => setNuevoUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') anadir() }}
              placeholder="usuario de Instagram (sin @)"
              aria-label="Usuario de Instagram"
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
              Al añadirlo se hace el primer scrape automático (datos públicos vía Apify, tarda ~1 min).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setDialogAdd(false)}>Cancelar</button>
              <button className="btn-primary" onClick={anadir} disabled={anadiendo || !nuevoUsername.trim()}>
                {anadiendo ? 'Añadiendo…' : 'Añadir'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Preview de la idea replicada */}
      {preview && (
        <>
          <div onClick={() => setPreview(null)} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.4)', zIndex: 60 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Idea replicada"
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 61, padding: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Idea replicada con tu voz</h2>
              <button className="btn-ghost" onClick={() => setPreview(null)} aria-label="Cerrar" style={{ padding: 6, minHeight: 32, minWidth: 32 }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
              Basada en un post de @{abierto?.username} · Formato sugerido: {preview.idea.formato}
            </p>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{preview.idea.titulo}</h3>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 10 }}>{preview.idea.gancho}</p>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {preview.idea.caption}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setPreview(null)}>Descartar</button>
              <button className="btn-primary" onClick={guardarReplica} disabled={guardandoReplica}>
                {guardandoReplica ? 'Guardando…' : 'Añadir al backlog'}
              </button>
            </div>
          </div>
        </>
      )}
    </PageTransition>
  )
}
