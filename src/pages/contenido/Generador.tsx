import { useState } from 'react'
import {
  InstagramLogo, LinkedinLogo, Lightbulb, UserCircle, Crown,
  Camera, Question, TrendUp, Sparkle, Copy, Check,
  BookmarkSimple, FloppyDisk, ArrowClockwise, Slideshow,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { generarPost, type PostGenerado } from '../../lib/claudeApi'
import { supabase } from '../../lib/supabaseClient'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'
import CarruselViewer from '../../components/CarruselViewer'

const TIPOS = [
  { id: 'tip', label: 'Tip educativo', icon: Lightbulb, desc: 'Consejo práctico del sector' },
  { id: 'caso_cliente', label: 'Caso de cliente', icon: UserCircle, desc: 'Historia de éxito real' },
  { id: 'autoridad', label: 'Post de autoridad', icon: Crown, desc: 'Posicionamiento experto' },
  { id: 'detras_camaras', label: 'Detrás de cámaras', icon: Camera, desc: 'Proceso interno de WIARE' },
  { id: 'objecion', label: 'Objeción respondida', icon: Question, desc: 'Desmonta una objeción común' },
  { id: 'tendencia', label: 'Tendencia del sector', icon: TrendUp, desc: 'IA, voz, automatización' },
]

const TEMAS_SUGERIDOS: Record<string, string[]> = {
  tip: ['Cómo evitar perder llamadas fuera de horario', 'Por qué el buzón de voz mata tu negocio', '3 señales de que necesitas atención 24/7'],
  caso_cliente: ['Clínica dental que dejó de perder pacientes', 'Restaurante que llena mesas sin recepcionista', 'Peluquería que triplicó sus citas online'],
  autoridad: ['El futuro de la atención al cliente local', 'Por qué los agentes de voz ya no son ciencia ficción', 'Lo que aprendimos instalando 10 agentes en España'],
  detras_camaras: ['Cómo montamos un agente en 7 días', 'Qué pasa cuando un cliente nos llama a medianoche', 'La primera llamada de un agente de voz nuevo'],
  objecion: ['"Es muy caro" — cómo lo respondemos', '"Mis clientes quieren hablar con personas"', '"No confío en las máquinas"'],
  tendencia: ['Los negocios locales y la IA en 2025', 'Por qué la voz va a superar al chat', 'El recepcionista digital ha llegado a España'],
}

export interface PostState {
  gancho: string
  cuerpo: string[]
  cta: string
  hashtags: string
}

export default function Generador() {
  const toast = useToast()

  const [redSocial, setRedSocial] = useState<'instagram' | 'linkedin'>('instagram')
  const [tipoPost, setTipoPost] = useState('tip')
  const [tema, setTema] = useState('')
  const [tono, setTono] = useState('cercano')
  const [generando, setGenerando] = useState(false)
  const [post, setPost] = useState<PostState | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [carruselAbierto, setCarruselAbierto] = useState(false)

  const temasActuales = TEMAS_SUGERIDOS[tipoPost] ?? []

  async function onGenerar() {
    if (!tema.trim()) { toast('Escribe un tema antes de generar', 'error'); return }
    setGenerando(true)
    setPost(null)
    try {
      const resultado: PostGenerado = await generarPost({ redSocial, tipoPost, tema, tono })
      setPost({ gancho: resultado.gancho, cuerpo: resultado.cuerpo, cta: resultado.cta, hashtags: resultado.hashtags })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar', 'error')
    } finally {
      setGenerando(false)
    }
  }

  async function onGuardar() {
    if (!post) return
    setGuardando(true)
    try {
      const { error } = await supabase.from('content_os').insert({
        red_social: redSocial,
        tipo_post: tipoPost,
        tema,
        tono,
        gancho: post.gancho,
        cuerpo: post.cuerpo,
        cta: post.cta,
        hashtags: post.hashtags,
        estado: 'borrador',
        creado_por: sessionStorage.getItem('wiare_user') ?? 'desconocido',
      })
      if (error) {
        console.error('Supabase insert error:', error)
        throw new Error(error.message ?? error.details ?? 'Error al guardar en Supabase')
      }
      toast('Post guardado en biblioteca', 'success')
    } catch (err) {
      console.error('onGuardar error:', err)
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  function copiarCampo(campo: string, texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(campo)
      setTimeout(() => setCopiado(null), 1800)
    })
  }

  function copiarTodo() {
    if (!post) return
    const texto = [post.gancho, '', ...post.cuerpo, '', post.cta, '', post.hashtags].join('\n')
    copiarCampo('todo', texto)
  }

  const tipoActivo = TIPOS.find((t) => t.id === tipoPost)

  return (
    <PageTransition>
      <PageHeader
        titulo="Generador de Posts"
        subtitulo="Crea contenido para Instagram y LinkedIn en segundos."
        acciones={
          post ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={copiarTodo} style={{ gap: 6 }}>
                {copiado === 'todo' ? <Check size={15} weight="bold" /> : <Copy size={15} />}
                {copiado === 'todo' ? 'Copiado' : 'Copiar todo'}
              </button>
              <button
                className="btn-primary"
                onClick={onGuardar}
                disabled={guardando}
                style={{ gap: 6 }}
              >
                {guardando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <FloppyDisk size={15} weight="fill" />}
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          ) : undefined
        }
      />

      <div
        className="contenido-grid"
        style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}
      >
        {/* ── Panel izquierdo — inputs ── */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Red social */}
          <div>
            <label style={labelStyle}>Red social</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              {(['instagram', 'linkedin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRedSocial(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${redSocial === r ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: redSocial === r ? 'var(--color-primary-subtle)' : '#fff',
                    color: redSocial === r ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {r === 'instagram' ? <InstagramLogo size={16} weight="fill" /> : <LinkedinLogo size={16} weight="fill" />}
                  {r === 'instagram' ? 'Instagram' : 'LinkedIn'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de post */}
          <div>
            <label style={labelStyle}>Tipo de post</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {TIPOS.map((t) => {
                const Icon = t.icon
                const activo = tipoPost === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTipoPost(t.id); setTema('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={15} weight={activo ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: activo ? 'var(--color-primary)' : 'var(--color-text-tertiary)', fontWeight: 400 }}>{t.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tema */}
          <div>
            <label style={labelStyle}>Tema</label>
            <textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Describe el tema en una frase…"
              rows={2}
              style={{ width: '100%', marginTop: 6, resize: 'vertical', minHeight: 64 }}
            />
            {temasActuales.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 5, fontWeight: 500 }}>Sugerencias</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {temasActuales.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTema(s)}
                      style={{
                        textAlign: 'left', fontSize: 12, color: 'var(--color-text-secondary)',
                        background: 'var(--color-surface-2)', border: 'none',
                        borderRadius: 'var(--radius-sm)', padding: '6px 10px',
                        cursor: 'pointer', lineHeight: 1.35,
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tono */}
          <div>
            <label style={labelStyle}>Tono</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {[
                { id: 'cercano', label: 'Cercano', desc: 'Como un DM entre conocidos' },
                { id: 'profesional', label: 'Profesional', desc: 'Claro y sin tecnicismos' },
                { id: 'directo', label: 'Directo', desc: 'Rotundo, afirmaciones fuertes' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTono(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${tono === t.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: tono === t.id ? 'var(--color-primary-subtle)' : '#fff',
                    color: tono === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: tono === t.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)', fontWeight: 400 }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Botón generar */}
          <button
            className="btn-primary"
            onClick={onGenerar}
            disabled={generando || !tema.trim()}
            style={{ width: '100%', minHeight: 44, gap: 8, fontSize: 14, fontWeight: 600 }}
          >
            {generando
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generando…</>
              : <><Sparkle size={16} weight="fill" /> {post ? 'Regenerar' : 'Generar post'}</>
            }
          </button>
        </div>

        {/* ── Panel derecho — output ── */}
        <div>
          <AnimatePresence mode="wait">
            {generando && !post && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card"
                style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--color-text-secondary)' }}
              >
                <span className="spinner" />
                <p style={{ fontSize: 14 }}>Generando tu post…</p>
              </motion.div>
            )}

            {!generando && !post && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card"
                style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}
              >
                <Sparkle size={36} weight="duotone" style={{ color: 'var(--color-primary)', opacity: 0.5 }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)' }}>El post aparecerá aquí</p>
                <p style={{ fontSize: 13 }}>
                  Elige el tipo de post, escribe un tema{tipoActivo ? ` sobre «${tipoActivo.label.toLowerCase()}»` : ''} y pulsa Generar.
                </p>
              </motion.div>
            )}

            {post && (
              <motion.div
                key="post"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {/* Chip red social */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {redSocial === 'instagram'
                    ? <InstagramLogo size={15} weight="fill" style={{ color: '#E1306C' }} />
                    : <LinkedinLogo size={15} weight="fill" style={{ color: '#0A66C2' }} />
                  }
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                    {redSocial} · {TIPOS.find((t) => t.id === tipoPost)?.label}
                  </span>
                  {generando && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginLeft: 'auto' }} />}
                  {!generando && (
                    <button
                      className="btn-ghost"
                      onClick={onGenerar}
                      disabled={generando}
                      style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px', minHeight: 30, gap: 5 }}
                    >
                      <ArrowClockwise size={13} />
                      Regenerar
                    </button>
                  )}
                </div>

                {/* Gancho */}
                <SeccionPost
                  titulo="Gancho"
                  copiado={copiado === 'gancho'}
                  onCopiar={() => copiarCampo('gancho', post.gancho)}
                >
                  <textarea
                    value={post.gancho}
                    onChange={(e) => setPost({ ...post, gancho: e.target.value })}
                    rows={2}
                    style={textareaPostStyle}
                  />
                </SeccionPost>

                {/* Cuerpo */}
                <SeccionPost
                  titulo="Desarrollo"
                  copiado={copiado === 'cuerpo'}
                  onCopiar={() => copiarCampo('cuerpo', post.cuerpo.join('\n\n'))}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {post.cuerpo.map((parrafo, i) => (
                      <textarea
                        key={i}
                        value={parrafo}
                        onChange={(e) => {
                          const nuevo = [...post.cuerpo]
                          nuevo[i] = e.target.value
                          setPost({ ...post, cuerpo: nuevo })
                        }}
                        rows={3}
                        style={{ ...textareaPostStyle, fontSize: 13 }}
                        placeholder={`Párrafo ${i + 1}`}
                      />
                    ))}
                  </div>
                </SeccionPost>

                {/* CTA */}
                <SeccionPost
                  titulo="CTA"
                  copiado={copiado === 'cta'}
                  onCopiar={() => copiarCampo('cta', post.cta)}
                >
                  <textarea
                    value={post.cta}
                    onChange={(e) => setPost({ ...post, cta: e.target.value })}
                    rows={2}
                    style={textareaPostStyle}
                  />
                </SeccionPost>

                {/* Hashtags */}
                <SeccionPost
                  titulo="Hashtags"
                  copiado={copiado === 'hashtags'}
                  onCopiar={() => copiarCampo('hashtags', post.hashtags)}
                >
                  <textarea
                    value={post.hashtags}
                    onChange={(e) => setPost({ ...post, hashtags: e.target.value })}
                    rows={2}
                    style={{ ...textareaPostStyle, color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                  />
                </SeccionPost>

                {/* Acciones finales */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={copiarTodo} style={{ gap: 6 }}>
                    {copiado === 'todo' ? <Check size={15} weight="bold" /> : <Copy size={15} />}
                    {copiado === 'todo' ? 'Copiado' : 'Copiar todo'}
                  </button>
                  {redSocial === 'instagram' && (
                    <button
                      className="btn-secondary"
                      onClick={() => setCarruselAbierto(true)}
                      style={{ gap: 6 }}
                    >
                      <Slideshow size={15} weight="fill" />
                      Ver carrusel
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    onClick={onGuardar}
                    disabled={guardando}
                    style={{ gap: 6 }}
                  >
                    {guardando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <BookmarkSimple size={15} weight="fill" />}
                    {guardando ? 'Guardando…' : 'Guardar en biblioteca'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {carruselAbierto && post && (
        <CarruselViewer
          post={post}
          tema={tema}
          tipoLabel={tipoActivo?.label ?? tipoPost}
          onClose={() => setCarruselAbierto(false)}
        />
      )}
    </PageTransition>
  )
}

function SeccionPost({ titulo, copiado, onCopiar, children }: {
  titulo: string
  copiado: boolean
  onCopiar: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="card"
      style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {titulo}
        </span>
        <button
          onClick={onCopiar}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: copiado ? 'var(--color-success)' : 'var(--color-text-tertiary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
            borderRadius: 'var(--radius-sm)', fontWeight: 500,
            transition: 'color var(--transition-fast)',
          }}
        >
          {copiado ? <Check size={12} weight="bold" /> : <Copy size={12} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {children}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
  display: 'block', letterSpacing: '0.02em',
}

const textareaPostStyle: React.CSSProperties = {
  width: '100%', resize: 'vertical', border: '1px solid transparent',
  background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
  padding: '8px 10px', fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-body)',
  color: 'var(--color-text-primary)',
  transition: 'border-color var(--transition-fast), background var(--transition-fast)',
}
