import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  InstagramLogo, LinkedinLogo, Plus, MagnifyingGlass, Funnel,
  Copy, Check, Trash, CalendarBlank, CaretDown, CaretUp,
  PencilSimple, BookOpen, ArrowSquareOut,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'

interface Post {
  id: string
  red_social: 'instagram' | 'linkedin'
  tipo_post: string
  tema: string | null
  tono: string | null
  gancho: string | null
  cuerpo: string[] | null
  cta: string | null
  hashtags: string | null
  estado: 'borrador' | 'listo' | 'publicado'
  fecha_programada: string | null
  creado_por: string | null
  created_at: string
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'var(--color-warning)',
  listo: 'var(--color-primary)',
  publicado: 'var(--color-success)',
}
const ESTADO_BG: Record<string, string> = {
  borrador: 'rgba(245,158,11,0.1)',
  listo: 'var(--color-primary-subtle)',
  publicado: 'rgba(34,197,94,0.1)',
}

const TIPO_LABELS: Record<string, string> = {
  tip: 'Tip educativo',
  caso_cliente: 'Caso de cliente',
  autoridad: 'Post de autoridad',
  detras_camaras: 'Detrás de cámaras',
  objecion: 'Objeción respondida',
  tendencia: 'Tendencia del sector',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BibliotecaContent() {
  const toast = useToast()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRed, setFiltroRed] = useState<'todas' | 'instagram' | 'linkedin'>('todas')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'borrador' | 'listo' | 'publicado'>('todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [editandoFecha, setEditandoFecha] = useState<string | null>(null)
  const [fechaEditar, setFechaEditar] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('content_os')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { toast('Error al cargar biblioteca', 'error') }
    else { setPosts((data ?? []) as Post[]) }
    setCargando(false)
  }

  async function cambiarEstado(id: string, estado: Post['estado']) {
    const { error } = await supabase.from('content_os').update({ estado }).eq('id', id)
    if (error) { toast('Error al actualizar', 'error'); return }
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, estado } : p))
    toast(`Estado → ${estado}`, 'success')
  }

  async function asignarFecha(id: string, fecha: string) {
    const { error } = await supabase.from('content_os').update({ fecha_programada: fecha || null }).eq('id', id)
    if (error) { toast('Error al programar', 'error'); return }
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, fecha_programada: fecha || null } : p))
    setEditandoFecha(null)
    toast(fecha ? 'Fecha programada' : 'Fecha eliminada', 'success')
  }

  async function duplicar(post: Post) {
    const { id: _, created_at: __, ...resto } = post
    const { error } = await supabase.from('content_os').insert({
      ...resto,
      estado: 'borrador',
      fecha_programada: null,
    })
    if (error) { toast('Error al duplicar', 'error'); return }
    toast('Post duplicado', 'success')
    cargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await supabase.from('content_os').delete().eq('id', id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
    if (expandido === id) setExpandido(null)
    toast('Post eliminado', 'success')
  }

  function copiarPost(post: Post) {
    const partes = [
      post.gancho ?? '',
      '',
      ...(post.cuerpo ?? []),
      '',
      post.cta ?? '',
      '',
      post.hashtags ?? '',
    ]
    navigator.clipboard.writeText(partes.join('\n').trim()).then(() => {
      setCopiado(post.id)
      setTimeout(() => setCopiado(null), 1800)
    })
  }

  const postsFiltrados = posts.filter((p) => {
    if (filtroRed !== 'todas' && p.red_social !== filtroRed) return false
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      return (
        p.gancho?.toLowerCase().includes(q) ||
        p.tema?.toLowerCase().includes(q) ||
        p.tipo_post?.includes(q) ||
        TIPO_LABELS[p.tipo_post]?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const contadores = {
    instagram: posts.filter((p) => p.red_social === 'instagram').length,
    linkedin: posts.filter((p) => p.red_social === 'linkedin').length,
    borrador: posts.filter((p) => p.estado === 'borrador').length,
    listo: posts.filter((p) => p.estado === 'listo').length,
    publicado: posts.filter((p) => p.estado === 'publicado').length,
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Biblioteca de Posts"
        subtitulo={`${posts.length} post${posts.length !== 1 ? 's' : ''} generado${posts.length !== 1 ? 's' : ''}`}
        acciones={
          <button className="btn-primary" onClick={() => navigate('/contenido/generador')} style={{ gap: 6 }}>
            <Plus size={15} weight="bold" />
            Nuevo post
          </button>
        }
      />

      {/* Métricas rápidas */}
      {posts.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Instagram', val: contadores.instagram, color: '#E1306C', icon: <InstagramLogo size={14} weight="fill" /> },
            { label: 'LinkedIn', val: contadores.linkedin, color: '#0A66C2', icon: <LinkedinLogo size={14} weight="fill" /> },
            { label: 'Borradores', val: contadores.borrador, color: 'var(--color-warning)', icon: null },
            { label: 'Listos', val: contadores.listo, color: 'var(--color-primary)', icon: null },
            { label: 'Publicados', val: contadores.publicado, color: 'var(--color-success)', icon: null },
          ].map((m) => (
            <div key={m.label} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.icon && <span style={{ color: m.color }}>{m.icon}</span>}
              <span style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: 'var(--font-display)' }}>{m.val}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            placeholder="Buscar posts…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>
        <select value={filtroRed} onChange={(e) => setFiltroRed(e.target.value as typeof filtroRed)} style={{ minWidth: 130 }}>
          <option value="todas">Todas las redes</option>
          <option value="instagram">Instagram ({contadores.instagram})</option>
          <option value="linkedin">LinkedIn ({contadores.linkedin})</option>
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} style={{ minWidth: 140 }}>
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador ({contadores.borrador})</option>
          <option value="listo">Listo ({contadores.listo})</option>
          <option value="publicado">Publicado ({contadores.publicado})</option>
        </select>
        {(busqueda || filtroRed !== 'todas' || filtroEstado !== 'todos') && (
          <button className="btn-ghost" onClick={() => { setBusqueda(''); setFiltroRed('todas'); setFiltroEstado('todos') }} style={{ fontSize: 12, minHeight: 36 }}>
            <Funnel size={13} />
            Limpiar
          </button>
        )}
      </div>

      {cargando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : postsFiltrados.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <BookOpen size={36} weight="duotone" style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {posts.length === 0 ? 'Biblioteca vacía' : 'Sin resultados'}
          </p>
          <p style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>
            {posts.length === 0 ? 'Genera tu primer post desde el Generador.' : 'Prueba con otros filtros.'}
          </p>
          {posts.length === 0 && (
            <button className="btn-primary" onClick={() => navigate('/contenido/generador')} style={{ gap: 6 }}>
              <Plus size={15} />
              Crear primer post
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {postsFiltrados.map((post) => {
            const abierto = expandido === post.id
            return (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ overflow: 'hidden' }}
              >
                {/* Cabecera de la tarjeta */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                  }}
                  onClick={() => setExpandido(abierto ? null : post.id)}
                >
                  {/* Icono red */}
                  <span style={{
                    width: 34, height: 34, borderRadius: 'var(--radius-md)',
                    background: post.red_social === 'instagram' ? 'rgba(225,48,108,0.1)' : 'rgba(10,102,194,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {post.red_social === 'instagram'
                      ? <InstagramLogo size={16} weight="fill" style={{ color: '#E1306C' }} />
                      : <LinkedinLogo size={16} weight="fill" style={{ color: '#0A66C2' }} />
                    }
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}>
                      {post.gancho?.split('\n')[0] ?? post.tema ?? 'Post sin título'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {TIPO_LABELS[post.tipo_post] ?? post.tipo_post}
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-border-strong)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {formatDate(post.created_at)}
                      </span>
                      {post.fecha_programada && (
                        <>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-border-strong)', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CalendarBlank size={10} weight="fill" />
                            {new Date(post.fecha_programada + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Estado — selector inline */}
                  <select
                    value={post.estado}
                    onChange={(e) => { e.stopPropagation(); cambiarEstado(post.id, e.target.value as Post['estado']) }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px',
                      borderRadius: 'var(--radius-full)', border: `1px solid ${ESTADO_COLORS[post.estado]}30`,
                      background: ESTADO_BG[post.estado], color: ESTADO_COLORS[post.estado],
                      cursor: 'pointer',
                    }}
                  >
                    <option value="borrador">Borrador</option>
                    <option value="listo">Listo</option>
                    <option value="publicado">Publicado</option>
                  </select>

                  {abierto ? <CaretUp size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> : <CaretDown size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
                </div>

                {/* Contenido expandido */}
                <AnimatePresence>
                  {abierto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 16px' }}>
                        {/* Gancho */}
                        {post.gancho && (
                          <SeccionVer titulo="Gancho" contenido={post.gancho} />
                        )}

                        {/* Cuerpo */}
                        {post.cuerpo && post.cuerpo.length > 0 && (
                          <SeccionVer titulo="Desarrollo" contenido={post.cuerpo.join('\n\n')} />
                        )}

                        {/* CTA */}
                        {post.cta && (
                          <SeccionVer titulo="CTA" contenido={post.cta} />
                        )}

                        {/* Hashtags */}
                        {post.hashtags && (
                          <div style={{ marginTop: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Hashtags
                            </span>
                            <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 4, lineHeight: 1.5 }}>
                              {post.hashtags}
                            </p>
                          </div>
                        )}

                        {/* Acciones */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => copiarPost(post)}
                            style={{ gap: 6, fontSize: 12, minHeight: 34 }}
                          >
                            {copiado === post.id ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                            {copiado === post.id ? 'Copiado' : 'Copiar post'}
                          </button>

                          {editandoFecha === post.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="date"
                                value={fechaEditar}
                                onChange={(e) => setFechaEditar(e.target.value)}
                                style={{ fontSize: 12, padding: '4px 8px' }}
                              />
                              <button className="btn-primary" onClick={() => asignarFecha(post.id, fechaEditar)} style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}>
                                OK
                              </button>
                              <button className="btn-ghost" onClick={() => setEditandoFecha(null)} style={{ minHeight: 30, padding: '4px 8px', fontSize: 12 }}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn-ghost"
                              onClick={() => { setEditandoFecha(post.id); setFechaEditar(post.fecha_programada ?? '') }}
                              style={{ gap: 5, fontSize: 12, minHeight: 34 }}
                            >
                              <CalendarBlank size={13} />
                              {post.fecha_programada ? 'Reprogramar' : 'Programar'}
                            </button>
                          )}

                          <button
                            className="btn-ghost"
                            onClick={() => duplicar(post)}
                            style={{ gap: 5, fontSize: 12, minHeight: 34 }}
                          >
                            <PencilSimple size={13} />
                            Duplicar
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => navigate('/contenido/calendario')}
                            style={{ gap: 5, fontSize: 12, minHeight: 34 }}
                          >
                            <ArrowSquareOut size={13} />
                            Ver en calendario
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => eliminar(post.id)}
                            style={{ gap: 5, fontSize: 12, minHeight: 34, color: 'var(--color-error)', marginLeft: 'auto' }}
                          >
                            <Trash size={13} />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageTransition>
  )
}

function SeccionVer({ titulo, contenido }: { titulo: string; contenido: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {titulo}
      </span>
      <p style={{ fontSize: 13, color: 'var(--color-text-primary)', marginTop: 4, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
        {contenido}
      </p>
    </div>
  )
}
