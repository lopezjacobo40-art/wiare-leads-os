import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight, CheckCircle, CalendarPlus, X } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import IdeaEditDialog from '../../components/content/IdeaEditDialog'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { planificarMes } from '../../lib/planificadorContenido'
import {
  fetchPillars, fetchIdeas, FORMATO_LABELS,
  type ContentIdea, type ContentPillar, type IdeaFormato,
} from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Calendario de contenidos — vista mensual.
   Cada día muestra sus piezas (programadas y publicadas)
   como etiquetas de color por tipo. Click en una pieza → editar.
   ───────────────────────────────────────────── */

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MAX_CHIPS_DIA = 3

function claveDia(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Calendario() {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [editando, setEditando] = useState<ContentIdea | null>(null)
  const [dialogPlan, setDialogPlan] = useState(false)
  const [postsSemana, setPostsSemana] = useState(3)
  const [historiasSemana, setHistoriasSemana] = useState(3)
  const [planificando, setPlanificando] = useState(false)

  const indigo = brand?.colores.indigo ?? '#6366F1'
  const cyan = brand?.colores.cyan ?? '#22D3EE'
  const colorFormato = (f: IdeaFormato): string => {
    if (f === 'carrusel' || f === 'secuencia') return indigo
    if (f === 'reel' || f === 'video') return cyan
    if (f === 'historia') return '#8B5CF6'
    return '#71717A'
  }

  const cargar = async () => {
    const [is, ps] = await Promise.all([fetchIdeas(), fetchPillars()])
    setIdeas(is)
    setPillars(ps)
    setLoading(false)
  }
   
  useEffect(() => { cargar() }, [])

  // Piezas con fecha, agrupadas por día (YYYY-MM-DD local)
  const porDia = useMemo(() => {
    const m = new Map<string, ContentIdea[]>()
    for (const i of ideas) {
      if (!i.fecha_publicacion) continue
      const k = claveDia(new Date(i.fecha_publicacion))
      const lista = m.get(k) ?? []
      lista.push(i)
      m.set(k, lista)
    }
    return m
  }, [ideas])

  // Celdas del mes: desde el lunes de la semana del día 1 hasta completar 6 filas
  const celdas = useMemo(() => {
    const primero = new Date(mes)
    const offset = (primero.getDay() + 6) % 7 // lunes = 0
    const inicio = new Date(primero)
    inicio.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      return d
    })
  }, [mes])

  const hoyClave = claveDia(new Date())
  const tituloMes = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const moverMes = (delta: number) =>
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  // Piezas del mes visible (para saber si está vacío y ofrecer planificar)
  const piezasDelMes = useMemo(
    () => ideas.filter((i) => {
      if (!i.fecha_publicacion) return false
      const f = new Date(i.fecha_publicacion)
      return f.getFullYear() === mes.getFullYear() && f.getMonth() === mes.getMonth()
    }).length,
    [ideas, mes]
  )

  const sinProgramar = useMemo(
    () => ideas.filter((i) => !i.fecha_publicacion && i.estado !== 'publicado' && i.formato !== 'historia').length,
    [ideas]
  )

  const ejecutarPlan = async () => {
    setPlanificando(true)
    const r = await planificarMes(mes, { postsSemana, historiasSemana }, ideas)
    setPlanificando(false)
    if (r.error) { toast(r.error, 'error'); return }
    const partes = [
      r.feedProgramadas > 0 && `${r.feedProgramadas} piezas de feed`,
      r.historiasProgramadas > 0 && `${r.historiasProgramadas} historias`,
    ].filter(Boolean)
    toast(
      partes.length > 0
        ? `Mes planificado: ${partes.join(' + ')}${r.slotsSinIdea > 0 ? ` · ${r.slotsSinIdea} huecos sin idea (genera más en el manager)` : ''}`
        : 'No había nada que programar — genera ideas en el Instagram Manager',
      partes.length > 0 ? 'success' : 'info'
    )
    setDialogPlan(false)
    cargar()
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Calendario de contenidos" subtitulo="Vista mensual de publicaciones programadas y publicadas" />
        <Skeleton.Rect width="100%" height={480} radius={14} />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Calendario de contenidos"
        subtitulo="Vista mensual de publicaciones programadas y publicadas"
        acciones={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-ghost" onClick={() => moverMes(-1)} aria-label="Mes anterior" style={{ padding: 8, minHeight: 34, minWidth: 34 }}>
              <CaretLeft size={15} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>
              {tituloMes}
            </span>
            <button className="btn-ghost" onClick={() => moverMes(1)} aria-label="Mes siguiente" style={{ padding: 8, minHeight: 34, minWidth: 34 }}>
              <CaretRight size={15} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => { const d = new Date(); setMes(new Date(d.getFullYear(), d.getMonth(), 1)) }}
              style={{ fontSize: 12, padding: '6px 12px', minHeight: 34 }}
            >
              Hoy
            </button>
            <button className="btn-primary" onClick={() => setDialogPlan(true)} style={{ fontSize: 13, minHeight: 36 }}>
              <CalendarPlus size={14} /> Planificar mes
            </button>
          </div>
        }
      />

      {/* Mes vacío → invitar a planificar */}
      {piezasDelMes === 0 && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', marginBottom: 14, flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Este mes no tiene contenido programado.
            {sinProgramar > 0 && <> Tienes <strong style={{ color: 'var(--color-text-primary)' }}>{sinProgramar} ideas sin fecha</strong> listas para repartir.</>}
          </span>
          <button className="btn-secondary" onClick={() => setDialogPlan(true)} style={{ fontSize: 12, minHeight: 32 }}>
            <CalendarPlus size={13} /> Planificar ahora
          </button>
        </div>
      )}

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 11, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
        {(['carrusel', 'reel', 'post', 'historia'] as IdeaFormato[]).map((f) => (
          <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFormato(f) }} />
            {FORMATO_LABELS[f]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={12} color="var(--color-success)" weight="fill" /> Publicado
        </span>
      </div>

      {/* Grid mensual */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {celdas.map((d, i) => {
            const k = claveDia(d)
            const delMes = d.getMonth() === mes.getMonth()
            const esHoy = k === hoyClave
            const piezas = porDia.get(k) ?? []
            return (
              <div
                key={i}
                style={{
                  minHeight: 96,
                  padding: 6,
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--color-border)' : 'none',
                  borderBottom: i < 35 ? '1px solid var(--color-border)' : 'none',
                  background: delMes ? '#fff' : 'var(--color-surface)',
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%',
                  fontSize: 11, fontWeight: esHoy ? 700 : 500,
                  background: esHoy ? 'var(--color-primary)' : 'transparent',
                  color: esHoy ? '#fff' : delMes ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {d.getDate()}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {piezas.slice(0, MAX_CHIPS_DIA).map((p) => {
                    const c = colorFormato(p.formato)
                    const publicada = p.estado === 'publicado'
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditando(p)}
                        title={`${p.titulo} (${FORMATO_LABELS[p.formato]})`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          width: '100%', border: 'none', textAlign: 'left',
                          background: `color-mix(in srgb, ${c} ${publicada ? 8 : 14}%, transparent)`,
                          color: c,
                          borderRadius: 'var(--radius-sm)',
                          padding: '2px 6px',
                          fontSize: 10.5,
                          fontWeight: 600,
                          minHeight: 'auto',
                          opacity: publicada ? 0.75 : 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        {publicada && <CheckCircle size={10} weight="fill" color="var(--color-success)" style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                      </button>
                    )
                  })}
                  {piezas.length > MAX_CHIPS_DIA && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', paddingLeft: 6 }}>
                      +{piezas.length - MAX_CHIPS_DIA} más
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editando && (
        <IdeaEditDialog
          idea={editando}
          pillars={pillars}
          onClose={() => setEditando(null)}
          onSaved={cargar}
        />
      )}

      {/* Dialog de planificación del mes */}
      {dialogPlan && (
        <>
          <div onClick={() => setDialogPlan(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.4)', zIndex: 60 }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Planificar mes"
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 61, padding: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
                Planificar {tituloMes}
              </h2>
              <button className="btn-ghost" onClick={() => setDialogPlan(false)} aria-label="Cerrar" style={{ padding: 6, minHeight: 32, minWidth: 32 }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              Reparte tus ideas sin fecha (posts, carruseles y reels a las 18:00) y programa
              historias con objetivo rotatorio (oferta, DMs, educar, prueba social — a las 12:00).
              Solo días futuros; puedes mover cualquier pieza después.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label htmlFor="plan-posts" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Feed / semana
                </label>
                <select
                  id="plan-posts"
                  value={postsSemana}
                  onChange={(e) => setPostsSemana(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: '#fff' }}
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'pieza' : 'piezas'}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="plan-historias" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Historias / semana
                </label>
                <select
                  id="plan-historias"
                  value={historiasSemana}
                  onChange={(e) => setHistoriasSemana(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: '#fff' }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'Sin historias' : `${n} ${n === 1 ? 'historia' : 'historias'}`}</option>)}
                </select>
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
              {sinProgramar} ideas de feed sin fecha disponibles. Si hay más huecos que ideas,
              los huecos quedan libres — genera más en el Instagram Manager.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setDialogPlan(false)}>Cancelar</button>
              <button className="btn-primary" onClick={ejecutarPlan} disabled={planificando}>
                <CalendarPlus size={14} /> {planificando ? 'Planificando…' : 'Planificar'}
              </button>
            </div>
          </div>
        </>
      )}
    </PageTransition>
  )
}
