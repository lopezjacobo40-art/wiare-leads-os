import { useEffect, useMemo, useState } from 'react'
import { ChartLineUp, ArrowsClockwise, TrendUp, TrendDown, ArrowSquareOut } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import {
  fetchCompetitors, fetchSnapshotsRecientes, fetchPostsSector,
  type CompetitorConMetricas, type CompetitorSnapshot, type CompetitorPost,
} from '../../lib/competitors'
import { fetchIdeas, type ContentIdea } from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Analítica de contenidos — con los datos que ya acumula el OS:
   snapshots de competidores (cron diario), sus posts recientes y
   tu actividad de publicación. Sin Meta API.

   Paleta categórica validada (dataviz, luz sobre #FAFAFA):
   indigo → cyan-600 → violeta → verde → ámbar-600.
   ───────────────────────────────────────────── */

const PALETA = ['#6366F1', '#0891B2', '#8B5CF6', '#16A34A', '#D97706']

const DIA_MS = 24 * 60 * 60 * 1000
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
// Instante de carga del módulo: evita Date.now() durante el render
const AHORA = Date.now()

function num(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-ES')
}

/* ── Tooltip compartido (sigue al ratón dentro del contenedor del chart) ── */
interface TipState { x: number; y: number; contenido: React.ReactNode }

function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: tip.x + 12,
        top: tip.y - 8,
        transform: 'translateY(-100%)',
        background: '#18181B',
        color: '#fff',
        fontSize: 11.5,
        lineHeight: 1.45,
        borderRadius: 'var(--radius-md)',
        padding: '7px 10px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow-md)',
        zIndex: 5,
      }}
    >
      {tip.contenido}
    </div>
  )
}

/* ── Barras verticales con hover (una serie, un tono) ── */
function Barras({
  datos, color, format = num, alto = 150,
}: {
  datos: { label: string; valor: number; detalle?: string }[]
  color: string
  format?: (n: number) => string
  alto?: number
}) {
  const [tip, setTip] = useState<TipState | null>(null)
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: alto }}>
        {datos.map((d) => {
          const h = Math.max(d.valor > 0 ? 4 : 2, Math.round((d.valor / max) * (alto - 26)))
          return (
            <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {d.valor > 0 ? format(d.valor) : ''}
              </span>
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.closest('[data-chart]')!.getBoundingClientRect()
                  setTip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    contenido: <><strong>{d.label}</strong>: {format(d.valor)}{d.detalle && <> · {d.detalle}</>}</>,
                  })
                }}
                onMouseLeave={() => setTip(null)}
                style={{
                  width: '100%',
                  maxWidth: 44,
                  height: h,
                  background: d.valor > 0 ? color : 'var(--color-surface-2)',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'default',
                }}
              />
              <span style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
      <Tip tip={tip} />
    </div>
  )
}

/* ── Líneas de followers por competidor (multi-serie + crosshair) ── */
function LineasFollowers({
  series,
}: {
  series: { nombre: string; color: string; puntos: { t: number; v: number }[] }[]
}) {
  const [tip, setTip] = useState<TipState | null>(null)
  const [guiaX, setGuiaX] = useState<number | null>(null)

  const W = 640
  const H = 200
  const PAD = { l: 8, r: 120, t: 10, b: 22 }

  const todos = series.flatMap((s) => s.puntos)
  const tMin = Math.min(...todos.map((p) => p.t))
  const tMax = Math.max(...todos.map((p) => p.t))
  const vMin = Math.min(...todos.map((p) => p.v))
  const vMax = Math.max(...todos.map((p) => p.v))
  const rangoV = Math.max(1, vMax - vMin)
  const rangoT = Math.max(1, tMax - tMin)

  const x = (t: number) => PAD.l + ((t - tMin) / rangoT) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - vMin) / rangoV) * (H - PAD.t - PAD.b)

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const t = tMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * rangoT
    setGuiaX(Math.min(Math.max(px, PAD.l), W - PAD.r))
    const filas = series.map((s) => {
      let mejor = s.puntos[0]
      for (const p of s.puntos) if (Math.abs(p.t - t) < Math.abs(mejor.t - t)) mejor = p
      return { nombre: s.nombre, color: s.color, v: mejor.v }
    })
    const fecha = new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const cont = e.currentTarget.closest('[data-chart]')!.getBoundingClientRect()
    setTip({
      x: e.clientX - cont.left,
      y: e.clientY - cont.top,
      contenido: (
        <>
          <strong>{fecha}</strong>
          {filas.map((f) => (
            <span key={f.nombre} style={{ display: 'block' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: f.color, marginRight: 5 }} />
              {f.nombre}: {num(f.v)}
            </span>
          ))}
        </>
      ),
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={onMove}
        onMouseLeave={() => { setTip(null); setGuiaX(null) }}
        role="img"
        aria-label="Evolución de followers por competidor en los últimos 30 días"
      >
        {/* Guías horizontales recesivas */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} stroke="var(--color-border)" strokeWidth="1" />
        ))}
        {guiaX != null && <line x1={guiaX} x2={guiaX} y1={PAD.t} y2={H - PAD.b} stroke="#A1A1AA" strokeWidth="1" strokeDasharray="3 3" />}

        {series.map((s) => {
          const d = s.puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
          const ultimo = s.puntos[s.puntos.length - 1]
          return (
            <g key={s.nombre}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(ultimo.t)} cy={y(ultimo.v)} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.5" />
              {/* Etiqueta directa al final de la línea (texto en tinta, marca de color al lado) */}
              <text x={x(ultimo.t) + 8} y={y(ultimo.v) + 4} fontSize="11" fontWeight="600" fill="var(--color-text-primary)">
                {s.nombre.length > 14 ? `${s.nombre.slice(0, 13)}…` : s.nombre}
              </text>
            </g>
          )
        })}
        {/* Eje temporal: extremos */}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--color-text-tertiary)">
          {new Date(tMin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--color-text-tertiary)" textAnchor="end">
          {new Date(tMax).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </text>
      </svg>
      <Tip tip={tip} />
    </div>
  )
}

/* ── Card contenedora de un bloque ── */
function Bloque({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card" data-chart style={{ padding: 20, position: 'relative' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{titulo}</h2>
      {sub && <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, marginBottom: 14 }}>{sub}</p>}
      {!sub && <div style={{ height: 14 }} />}
      {children}
    </section>
  )
}

export default function Analitica() {
  const [comps, setComps] = useState<CompetitorConMetricas[]>([])
  const [snaps, setSnaps] = useState<CompetitorSnapshot[]>([])
  const [posts, setPosts] = useState<CompetitorPost[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    const [c, s, p, i] = await Promise.all([
      fetchCompetitors(), fetchSnapshotsRecientes(30), fetchPostsSector(30), fetchIdeas(),
    ])
    setComps(c)
    setSnaps(s)
    setPosts(p)
    setIdeas(i)
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  // Color fijo por competidor según orden de creación (nunca se recicla al filtrar)
  const colorComp = useMemo(() => {
    const m = new Map<string, string>()
    comps.forEach((c, i) => m.set(c.id, PALETA[i % PALETA.length]))
    return m
  }, [comps])

  const seriesFollowers = useMemo(() => {
    return comps
      .map((c) => ({
        nombre: `@${c.username}`,
        color: colorComp.get(c.id)!,
        puntos: snaps
          .filter((s) => s.competitor_id === c.id && s.followers != null)
          .map((s) => ({ t: new Date(s.capturado_en).getTime(), v: s.followers! })),
      }))
      .filter((s) => s.puntos.length >= 2)
      .slice(0, 5)
  }, [comps, snaps, colorComp])

  // Interacción media por formato del sector
  const porFormato = useMemo(() => {
    const grupos: Record<string, { total: number; n: number }> = {}
    for (const p of posts) {
      const tipo = p.tipo === 'Video' ? 'Reels' : p.tipo === 'Sidecar' ? 'Carruseles' : 'Fotos'
      grupos[tipo] = grupos[tipo] ?? { total: 0, n: 0 }
      grupos[tipo].total += (p.likes ?? 0) + (p.comments ?? 0)
      grupos[tipo].n++
    }
    return ['Reels', 'Carruseles', 'Fotos']
      .filter((t) => grupos[t])
      .map((t) => ({ label: t, valor: Math.round(grupos[t].total / grupos[t].n), detalle: `${grupos[t].n} posts` }))
  }, [posts])

  // Publicaciones del sector por día de la semana
  const porDia = useMemo(() => {
    const conteo = Array(7).fill(0)
    for (const p of posts) {
      if (!p.publicado_en) continue
      conteo[(new Date(p.publicado_en).getDay() + 6) % 7]++
    }
    return DIAS_SEMANA.map((d, i) => ({ label: d, valor: conteo[i] }))
  }, [posts])

  // Tu ritmo: publicadas por semana (últimas 8)
  const miRitmo = useMemo(() => {
    const semanas = Array.from({ length: 8 }, (_, i) => ({
      label: i === 7 ? 'Esta' : `S-${7 - i}`,
      desde: AHORA - (8 - i) * 7 * DIA_MS,
      hasta: AHORA - (7 - i) * 7 * DIA_MS,
      valor: 0,
    }))
    for (const idea of ideas) {
      if (idea.estado !== 'publicado' || !idea.fecha_publicacion) continue
      const t = new Date(idea.fecha_publicacion).getTime()
      const s = semanas.find((w) => t >= w.desde && t < w.hasta)
      if (s) s.valor++
    }
    return semanas.map(({ label, valor }) => ({ label, valor }))
  }, [ideas])

  const stats = useMemo(() => {
    const publicadas30d = ideas.filter((i) => i.estado === 'publicado' && i.fecha_publicacion && AHORA - new Date(i.fecha_publicacion).getTime() < 30 * DIA_MS).length
    const programadas = ideas.filter((i) => i.estado === 'listo' && i.fecha_publicacion && new Date(i.fecha_publicacion).getTime() > AHORA).length
    const mediaSector = posts.length > 0
      ? Math.round(posts.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0), 0) / posts.length)
      : null
    return { publicadas30d, programadas, mediaSector }
  }, [ideas, posts])

  const topPosts = useMemo(() => posts.slice(0, 5), [posts])
  const usernameDe = (id: string) => comps.find((c) => c.id === id)?.username ?? '?'

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Analítica" subtitulo="Tu actividad y el pulso del sector, con los datos de competidores" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton.Rect key={i} width="100%" height={220} radius={14} />)}
        </div>
      </PageTransition>
    )
  }

  const sinDatos = comps.length === 0

  return (
    <PageTransition>
      <PageHeader
        titulo="Analítica"
        subtitulo="Tu actividad y el pulso del sector, con los datos de competidores"
        acciones={
          <button className="btn-secondary" onClick={cargar} style={{ fontSize: 13, minHeight: 36 }}>
            <ArrowsClockwise size={14} /> Actualizar
          </button>
        }
      />

      {sinDatos ? (
        <div className="card" style={{ padding: 0, maxWidth: 860 }}>
          <EmptyState
            icon={ChartLineUp}
            titulo="Aún no hay datos que analizar"
            descripcion="Añade competidores en su sección: cada refresh (y el cron diario) acumula followers, engagement y posts del sector que alimentan esta página."
          />
        </div>
      ) : (
        <>
          {/* Fila de stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Publicadas (30d)', valor: String(stats.publicadas30d), pie: 'piezas tuyas' },
              { label: 'Programadas', valor: String(stats.programadas), pie: 'en el calendario' },
              { label: 'Competidores', valor: String(comps.length), pie: 'en seguimiento' },
              { label: 'Interacción media sector', valor: stats.mediaSector != null ? num(stats.mediaSector) : '—', pie: 'likes+coment. por post (30d)' },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                <span style={{ display: 'block', fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{s.valor}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{s.pie}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {/* Followers de competidores */}
            <section className="card" data-chart style={{ padding: 20, position: 'relative', gridColumn: '1 / -1' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Followers de competidores — últimos 30 días</h2>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, marginBottom: 14 }}>
                Un punto por snapshot (el cron guarda uno al día por competidor)
              </p>
              {seriesFollowers.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', padding: '18px 0' }}>
                  Todavía no hay suficientes snapshots (hacen falta 2+ por competidor). El cron diario los irá acumulando solo.
                </p>
              ) : (
                <>
                  <LineasFollowers series={seriesFollowers} />
                  {/* Leyenda (además de la etiqueta directa) */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
                    {seriesFollowers.map((s) => {
                      const ult = s.puntos[s.puntos.length - 1].v
                      const pri = s.puntos[0].v
                      const delta = ult - pri
                      return (
                        <span key={s.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
                          {s.nombre} · {num(ult)}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: delta > 0 ? 'var(--color-success)' : delta < 0 ? 'var(--color-error)' : 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            {delta !== 0 && (delta > 0 ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />)}
                            {delta > 0 ? '+' : ''}{num(delta)}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                  {/* Vista de tabla accesible */}
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>Ver como tabla</summary>
                    <table style={{ fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
                      <thead><tr>{['Competidor', 'Inicio', 'Ahora', 'Δ'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {seriesFollowers.map((s) => (
                          <tr key={s.nombre}>
                            <td style={{ padding: '3px 12px 3px 0' }}>{s.nombre}</td>
                            <td style={{ padding: '3px 12px 3px 0', fontVariantNumeric: 'tabular-nums' }}>{num(s.puntos[0].v)}</td>
                            <td style={{ padding: '3px 12px 3px 0', fontVariantNumeric: 'tabular-nums' }}>{num(s.puntos[s.puntos.length - 1].v)}</td>
                            <td style={{ padding: '3px 12px 3px 0', fontVariantNumeric: 'tabular-nums' }}>{num(s.puntos[s.puntos.length - 1].v - s.puntos[0].v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </section>

            {/* Formato que funciona */}
            <Bloque titulo="Qué formato funciona en el sector" sub="Interacción media (likes + comentarios) por tipo de post de tus competidores, 30 días">
              {porFormato.length === 0
                ? <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Sin posts del sector todavía.</p>
                : <Barras datos={porFormato} color="#6366F1" />}
            </Bloque>

            {/* Días de publicación del sector */}
            <Bloque titulo="Qué días publica el sector" sub="Posts de competidores por día de la semana, 30 días">
              {posts.length === 0
                ? <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Sin posts del sector todavía.</p>
                : <Barras datos={porDia} color="#0891B2" />}
            </Bloque>

            {/* Tu ritmo */}
            <Bloque titulo="Tu ritmo de publicación" sub="Piezas marcadas como publicadas por semana, últimas 8 semanas">
              <Barras datos={miRitmo} color="#8B5CF6" />
            </Bloque>

            {/* Top posts del sector */}
            <Bloque titulo="Top posts del sector (30d)" sub="Los que más interacción han generado — candidatos a replicar">
              {topPosts.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Sin posts del sector todavía.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topPosts.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', width: 16, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{usernameDe(p.competitor_id)} — {p.caption?.slice(0, 60) || '(sin caption)'}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {num((p.likes ?? 0) + (p.comments ?? 0))}
                      </span>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="btn-ghost" aria-label="Ver post" style={{ padding: 4, minHeight: 26, minWidth: 26 }}>
                          <ArrowSquareOut size={13} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Bloque>
          </div>
        </>
      )}
    </PageTransition>
  )
}
