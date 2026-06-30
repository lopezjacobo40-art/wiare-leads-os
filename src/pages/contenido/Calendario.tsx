import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  InstagramLogo, LinkedinLogo, CalendarBlank, Plus,
  ArrowLeft, ArrowRight, Sparkle, PencilSimple, Trash,
  CheckCircle, CircleNotch,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { generarCalendarioMensual } from '../../lib/claudeApi'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'

interface Post {
  id: string
  red_social: 'instagram' | 'linkedin'
  tipo_post: string
  tema: string | null
  gancho: string | null
  estado: 'borrador' | 'listo' | 'publicado'
  fecha_programada: string | null
  created_at: string
}

const DIAS_CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TIPO_LABELS: Record<string, string> = {
  tip: 'Tip educativo',
  caso_cliente: 'Caso cliente',
  autoridad: 'Autoridad',
  detras_camaras: 'Detrás cámaras',
  objecion: 'Objeción',
  tendencia: 'Tendencia',
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'var(--color-warning)',
  listo: 'var(--color-primary)',
  publicado: 'var(--color-success)',
}

const ESTADO_BG: Record<string, string> = {
  borrador: 'rgba(245,158,11,0.12)',
  listo: 'var(--color-primary-subtle)',
  publicado: 'rgba(34,197,94,0.12)',
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getFirstDayOffset(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function Calendario() {
  const toast = useToast()
  const navigate = useNavigate()
  const today = new Date()
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [anio, setAnio] = useState(today.getFullYear())
  const [posts, setPosts] = useState<Post[]>([])
  const [cargando, setCargando] = useState(true)
  const [rellenando, setRellenando] = useState(false)
  const [asignando, setAsignando] = useState<{ id: string; fecha: string } | null>(null)
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('content_os')
      .select('id, red_social, tipo_post, tema, gancho, estado, fecha_programada, created_at')
      .order('fecha_programada', { ascending: true, nullsFirst: false })
    if (error) toast('Error al cargar posts', 'error')
    else setPosts((data ?? []) as Post[])
    setCargando(false)
  }

  async function cambiarEstado(id: string, estado: Post['estado']) {
    const siguiente: Record<Post['estado'], Post['estado']> = {
      borrador: 'listo', listo: 'publicado', publicado: 'borrador',
    }
    const nuevoEstado = siguiente[estado]
    await supabase.from('content_os').update({ estado: nuevoEstado }).eq('id', id)
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, estado: nuevoEstado } : p))
  }

  async function asignarFecha(id: string, fecha: string) {
    if (!fecha) return
    await supabase.from('content_os').update({ fecha_programada: fecha }).eq('id', id)
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, fecha_programada: fecha } : p))
    setAsignando(null)
    toast('Fecha asignada', 'success')
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await supabase.from('content_os').delete().eq('id', id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
    toast('Post eliminado', 'success')
  }

  async function rellenarMes() {
    setRellenando(true)
    try {
      const entradas = await generarCalendarioMensual({ mes, anio })
      let insertados = 0
      for (const e of entradas) {
        const { error } = await supabase.from('content_os').insert({
          red_social: e.red_social,
          tipo_post: e.tipo_post,
          tema: e.tema,
          tono: 'cercano',
          gancho: null,
          cuerpo: [],
          cta: null,
          hashtags: null,
          estado: 'borrador',
          fecha_programada: e.fecha,
          creado_por: sessionStorage.getItem('wiare_user') ?? 'ia',
        })
        if (!error) insertados++
      }
      toast(`${insertados} posts añadidos al calendario`, 'success')
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar el calendario', 'error')
    } finally {
      setRellenando(false)
    }
  }

  function prevMes() {
    if (mes === 1) { setMes(12); setAnio(anio - 1) }
    else setMes(mes - 1)
  }
  function nextMes() {
    if (mes === 12) { setMes(1); setAnio(anio + 1) }
    else setMes(mes + 1)
  }

  const hoy = toISO(today)
  const diasDelMes = getDaysInMonth(anio, mes)
  const offset = getFirstDayOffset(anio, mes)
  const postsPorFecha = (iso: string) => posts.filter((p) => p.fecha_programada === iso)
  const postsSinFecha = posts.filter((p) => !p.fecha_programada)

  const mesLabel = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', {
    month: 'long', year: 'numeric',
  })

  const igCount = posts.filter((p) => p.fecha_programada?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`)).filter((p) => p.red_social === 'instagram').length
  const liCount = posts.filter((p) => p.fecha_programada?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`)).filter((p) => p.red_social === 'linkedin').length

  return (
    <PageTransition>
      <PageHeader
        titulo="Calendario editorial"
        subtitulo="Plan mensual completo. Sin pensar qué publicar."
        acciones={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={rellenarMes}
              disabled={rellenando}
              style={{ gap: 6 }}
            >
              {rellenando
                ? <CircleNotch size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
                : <Sparkle size={15} weight="fill" />
              }
              {rellenando ? 'Generando…' : 'Rellenar mes con IA'}
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/contenido/generador')}
              style={{ gap: 6 }}
            >
              <Plus size={15} weight="bold" />
              Crear post
            </button>
          </div>
        }
      />

      {cargando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : (
        <>
          {/* ── Navegación mes ── */}
          <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
            }}>
              <button className="btn-ghost" onClick={prevMes} style={{ minHeight: 32, padding: '6px 10px' }}>
                <ArrowLeft size={15} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                  {mesLabel}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#E1306C', fontWeight: 600 }}>
                    <InstagramLogo size={13} weight="fill" /> {igCount}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#0A66C2', fontWeight: 600 }}>
                    <LinkedinLogo size={13} weight="fill" /> {liCount}
                  </span>
                </div>
              </div>

              <button className="btn-ghost" onClick={nextMes} style={{ minHeight: 32, padding: '6px 10px' }}>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Cabecera días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
              {DIAS_CABECERA.map((d) => (
                <div key={d} style={{
                  padding: '8px 0', textAlign: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid mes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {/* Offset vacío para alinear el primer día */}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`off-${i}`} style={{
                  minHeight: 100, borderRight: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }} />
              ))}

              {diasDelMes.map((dia, i) => {
                const iso = toISO(dia)
                const esHoy = iso === hoy
                const esMesActual = dia.getMonth() + 1 === mes
                const colIndex = (offset + i) % 7
                const postsDelDia = postsPorFecha(iso)
                const isExpandido = diaExpandido === iso

                return (
                  <motion.div
                    key={iso}
                    layout
                    style={{
                      minHeight: 100,
                      borderRight: colIndex < 6 ? '1px solid var(--color-border)' : 'none',
                      borderBottom: '1px solid var(--color-border)',
                      padding: '8px 6px',
                      background: esHoy
                        ? 'rgba(99,102,241,0.04)'
                        : !esMesActual
                          ? 'var(--color-surface)'
                          : 'transparent',
                      position: 'relative',
                      cursor: postsDelDia.length > 0 ? 'pointer' : 'default',
                    }}
                    onClick={() => postsDelDia.length > 0 && setDiaExpandido(isExpandido ? null : iso)}
                  >
                    {/* Número del día */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: esHoy ? 700 : 500,
                        color: esHoy ? '#fff' : !esMesActual ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                        background: esHoy ? 'var(--color-primary)' : 'transparent',
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {dia.getDate()}
                      </span>
                    </div>

                    {/* Posts del día */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {(isExpandido ? postsDelDia : postsDelDia.slice(0, 2)).map((p) => (
                        <PostPill
                          key={p.id}
                          post={p}
                          onCambiarEstado={() => cambiarEstado(p.id, p.estado)}
                          onEliminar={() => eliminar(p.id)}
                          onEditar={() => navigate('/contenido/biblioteca')}
                          expanded={isExpandido}
                        />
                      ))}
                      {!isExpandido && postsDelDia.length > 2 && (
                        <span style={{
                          fontSize: 10, color: 'var(--color-text-tertiary)',
                          fontWeight: 600, textAlign: 'center', paddingTop: 1,
                        }}>
                          +{postsDelDia.length - 2} más
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* ── Sin fecha ── */}
          {postsSinFecha.length > 0 && (
            <div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                color: 'var(--color-text-secondary)', marginBottom: 10,
              }}>
                Sin fecha · {postsSinFecha.length}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {postsSinFecha.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                      background: p.red_social === 'instagram' ? 'rgba(225,48,108,0.1)' : 'rgba(10,102,194,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {p.red_social === 'instagram'
                        ? <InstagramLogo size={14} weight="fill" style={{ color: '#E1306C' }} />
                        : <LinkedinLogo size={14} weight="fill" style={{ color: '#0A66C2' }} />
                      }
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.gancho ?? p.tema ?? 'Post sin título'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {TIPO_LABELS[p.tipo_post] ?? p.tipo_post}
                      </p>
                    </div>
                    <span className="badge" style={{ background: ESTADO_BG[p.estado], color: ESTADO_COLORS[p.estado], fontSize: 10 }}>
                      {p.estado}
                    </span>

                    {asignando?.id === p.id ? (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <input
                          type="date"
                          value={asignando.fecha}
                          onChange={(e) => setAsignando({ id: p.id, fecha: e.target.value })}
                          style={{ fontSize: 12, padding: '4px 8px', minWidth: 130 }}
                        />
                        <button className="btn-primary" onClick={() => asignarFecha(p.id, asignando.fecha)} style={{ minHeight: 28, padding: '3px 10px', fontSize: 12 }}>
                          Asignar
                        </button>
                        <button className="btn-ghost" onClick={() => setAsignando(null)} style={{ minHeight: 28, padding: '3px 8px', fontSize: 12 }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-ghost"
                        onClick={() => setAsignando({ id: p.id, fecha: '' })}
                        style={{ minHeight: 28, padding: '3px 10px', fontSize: 12, gap: 5 }}
                      >
                        <CalendarBlank size={12} />
                        Programar
                      </button>
                    )}

                    <button className="btn-ghost" onClick={() => eliminar(p.id)} style={{ minHeight: 28, padding: '3px 8px', color: 'var(--color-error)' }}>
                      <Trash size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {posts.length === 0 && (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <CalendarBlank size={36} weight="duotone" style={{ opacity: 0.4, marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Calendario vacío</p>
              <p style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>
                Pulsa "Rellenar mes con IA" y genera el mes completo en segundos.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={rellenarMes} disabled={rellenando} style={{ gap: 6 }}>
                  {rellenando
                    ? <CircleNotch size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
                    : <Sparkle size={15} weight="fill" />
                  }
                  Rellenar mes con IA
                </button>
                <button className="btn-primary" onClick={() => navigate('/contenido/generador')} style={{ gap: 6 }}>
                  <Plus size={15} />
                  Crear post manualmente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageTransition>
  )
}

function PostPill({ post, onCambiarEstado, onEliminar, onEditar, expanded }: {
  post: Post
  onCambiarEstado: () => void
  onEliminar: () => void
  onEditar: () => void
  expanded: boolean
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          borderRadius: 4,
          background: ESTADO_BG[post.estado],
          border: `1px solid ${ESTADO_COLORS[post.estado]}30`,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 5px' }}>
          {post.red_social === 'instagram'
            ? <InstagramLogo size={10} weight="fill" style={{ color: '#E1306C', flexShrink: 0 }} />
            : <LinkedinLogo size={10} weight="fill" style={{ color: '#0A66C2', flexShrink: 0 }} />
          }
          <span style={{
            fontSize: 10, fontWeight: 600, color: ESTADO_COLORS[post.estado],
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {TIPO_LABELS[post.tipo_post] ?? post.tipo_post}
          </span>
          {post.estado === 'publicado' && (
            <CheckCircle size={9} weight="fill" style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          )}
        </div>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: '4px 5px 5px', borderTop: `1px solid ${ESTADO_COLORS[post.estado]}20` }}
          >
            {post.gancho || post.tema ? (
              <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: 5 }}>
                {(post.gancho ?? post.tema ?? '').split('\n')[0].slice(0, 80)}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onCambiarEstado() }}
                style={{
                  flex: 1, fontSize: 9, fontWeight: 600, padding: '2px 0',
                  borderRadius: 3, border: `1px solid ${ESTADO_COLORS[post.estado]}40`,
                  background: 'transparent', color: ESTADO_COLORS[post.estado],
                  cursor: 'pointer',
                }}
              >
                {post.estado === 'borrador' ? 'Marcar listo' : post.estado === 'listo' ? 'Publicado' : 'Borrador'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditar() }}
                style={{
                  width: 20, height: 18, borderRadius: 3, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <PencilSimple size={9} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEliminar() }}
                style={{
                  width: 20, height: 18, borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)',
                  background: 'transparent', color: 'var(--color-error)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Trash size={9} />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
