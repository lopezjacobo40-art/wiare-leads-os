import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Microphone, FileText, CurrencyEur, Note,
  Phone, Globe, MapPin, Star, Clock,
  Waveform, Broadcast, ArrowClockwise, CheckCircle, PencilSimple, ArrowRight,
  EnvelopeSimple, MagnifyingGlass, Warning, X, Brain, Copy, PaperPlane, FloppyDisk,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { generarSystemPrompt, generarPropuesta, generarContenidoSlides, generarEstrategiaOutreach, generarEmailOutreach, type EstrategiaOutreach, type SlidesContent } from '../lib/claudeApi'
import { crearAgentDemo } from '../lib/retellApi'
import { buscarEmailApify } from '../lib/apifyClient'
import { labelFuente } from '../lib/emailFinder'
import ScoreBadge from '../components/ScoreBadge'
import FuenteBadge from '../components/FuenteBadge'
import PropuestaViewer from '../components/PropuestaViewer'
import PropuestaSlides from '../components/PropuestaSlides'
import FaseSelector from '../components/FaseSelector'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'

// Fila de dato del negocio (4D): icono semántico + label uppercase + valor, separadas por border-bottom.
function DatoFila({
  icon: Icon,
  color,
  label,
  children,
}: {
  icon: typeof Phone
  color: string
  label: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Icon size={14} weight="fill" style={{ color, flexShrink: 0, marginTop: 3 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-tertiary)',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

type Tab = 'demo' | 'propuesta' | 'costes' | 'notas' | 'email'

const TABS: { id: Tab; label: string; icon: typeof Microphone }[] = [
  { id: 'demo', label: 'Demo Retell', icon: Microphone },
  { id: 'propuesta', label: 'Propuesta', icon: FileText },
  { id: 'costes', label: 'Costes', icon: CurrencyEur },
  { id: 'notas', label: 'Notas', icon: Note },
  { id: 'email', label: 'Email Outreach', icon: EnvelopeSimple },
]

const DAILY_EMAIL_LIMIT = Number(import.meta.env.VITE_DAILY_EMAIL_LIMIT ?? 10)

// Costes internos escalados según MRR (90€ → ~21€, 390€ → ~66€)
function calcularCostes(mrr: number) {
  const t = Math.min(1, Math.max(0, (mrr - 90) / 300))
  const retell = Math.round(15 + t * 25)
  const elevenlabs = Math.round(5 + t * 10)
  const supabaseCoste = Math.round(t * 10)
  const twilio = 1
  return { retell, elevenlabs, supabase: supabaseCoste, twilio, total: retell + elevenlabs + supabaseCoste + twilio }
}

const metricaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-tertiary)',
  marginBottom: 4,
}

const promptTextareaStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'monospace',
  fontSize: 13,
  lineHeight: 1.6,
  padding: 16,
  minHeight: 300,
  resize: 'vertical',
}

export default function LeadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('demo')
  const [error, setError] = useState('')

  // demo
  const [promptDraft, setPromptDraft] = useState('')
  const [generandoPrompt, setGenerandoPrompt] = useState(false)
  const [desplegando, setDesplegando] = useState(false)

  // propuesta
  const [generandoPropuesta, setGenerandoPropuesta] = useState(false)
  const [editandoPropuesta, setEditandoPropuesta] = useState(false)
  const [propuestaDraft, setPropuestaDraft] = useState('')
  const [modoPropuesta, setModoPropuesta] = useState<'texto' | 'slides'>('texto')
  const [generandoSlides, setGenerandoSlides] = useState(false)

  // notas
  const [notas, setNotas] = useState('')
  const [notasGuardadas, setNotasGuardadas] = useState<string | null>(null)

  // email finder
  const [buscandoEmail, setBuscandoEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')

  // outreach
  const [outreachStep, setOutreachStep] = useState<'idle' | 'estrategia' | 'email'>('idle')
  const [generandoEstrategia, setGenerandoEstrategia] = useState(false)
  const [generandoEmail, setGenerandoEmail] = useState(false)
  const [estrategia, setEstrategia] = useState<EstrategiaOutreach | null>(null)
  const [asuntoSeleccionado, setAsuntoSeleccionado] = useState(0)
  const [emailOutreach, setEmailOutreach] = useState<{ asunto: string; cuerpo: string } | null>(null)
  const [cuerpoEditado, setCuerpoEditado] = useState('')
  const [vendedor, setVendedor] = useState(() => sessionStorage.getItem('wiare_user') ?? 'Jacobo')
  const [emailsHoy, setEmailsHoy] = useState(0)

  useEffect(() => {
    setLoading(true)
    setLead(null)
    setError('')
    supabase
      .from('leads_os')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else if (!data) {
          setError('Lead no encontrado')
        } else {
          const l = data as Lead
          setLead(l)
          setNotas(l.notas ?? '')
          setPromptDraft(l.system_prompt_sofia ?? '')
          setEmailDraft(l.email ?? '')
        }
        setLoading(false)
      })
  }, [id])

  const actualizar = async (campos: Partial<Lead>) => {
    if (!lead) return
    const { error: err } = await supabase.from('leads_os').update(campos).eq('id', lead.id)
    if (err) { setError(err.message); toast(err.message, 'error'); return }
    setLead({ ...lead, ...campos })
  }

  const generarSlides = async () => {
    if (!lead) return
    setGenerandoSlides(true)
    setError('')
    try {
      const slides = await generarContenidoSlides(lead)
      const updates: Record<string, unknown> = {
        propuesta_slides: slides,
        propuesta_tipo: 'slides',
      }
      const fasesAnteriores = ['nuevo', 'cualificado', 'demo_creada']
      if (fasesAnteriores.includes(lead.fase)) updates.fase = 'propuesta_creada'
      await actualizar(updates)
      setModoPropuesta('slides')
      toast('Slides generadas', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error generando slides'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGenerandoSlides(false)
    }
  }

  const buscarEmailLead = async () => {
    if (!lead) return
    setBuscandoEmail(true)
    try {
      const email = await buscarEmailApify(lead.google_place_id ?? '', lead.web)
      if (email) {
        setEmailDraft(email)
        await actualizar({
          email,
          email_fuente: 'apify',
          email_verificado: false,
        })
        toast(`Email encontrado: ${email}`, 'success')
      } else {
        toast('No se encontró email', 'error')
      }
    } catch {
      toast('Error buscando email', 'error')
    } finally {
      setBuscandoEmail(false)
    }
  }

  const guardarEmailManual = async () => {
    if (!lead || !emailDraft.trim()) return
    await actualizar({ email: emailDraft.trim(), email_fuente: 'manual', email_verificado: true })
    toast('Email guardado', 'success')
  }

  const cambiarFase = async (fase: string) => {
    if (!lead || fase === lead.fase) return
    await actualizar({ fase })
    toast(`Fase: ${FASE_LABELS[fase] ?? fase}`, 'success')
  }

  useEffect(() => {
    const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
    const fecha = new Date().toISOString().split('T')[0]
    supabase
      .from('token_usage_os')
      .select('*', { count: 'exact', head: true })
      .eq('usuario', usuario)
      .eq('accion', 'email_enviado')
      .eq('fecha', fecha)
      .then(({ count }) => setEmailsHoy(count ?? 0))
  }, [])

  const crearEstrategia = async () => {
    if (!lead) return
    setGenerandoEstrategia(true)
    setEstrategia(null)
    setEmailOutreach(null)
    try {
      const e = await generarEstrategiaOutreach(lead)
      setEstrategia(e)
      setAsuntoSeleccionado(0)
      setOutreachStep('estrategia')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando estrategia', 'error')
    } finally {
      setGenerandoEstrategia(false)
    }
  }

  const crearEmail = async () => {
    if (!lead || !estrategia) return
    setGenerandoEmail(true)
    try {
      const e = await generarEmailOutreach(
        lead,
        { ...estrategia, opciones_asunto: [estrategia.opciones_asunto[asuntoSeleccionado]] },
        vendedor
      )
      setEmailOutreach(e)
      setCuerpoEditado(e.cuerpo)
      setOutreachStep('email')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error generando email', 'error')
    } finally {
      setGenerandoEmail(false)
    }
  }

  const registrarEmailOutreach = async (estado: 'enviado' | 'borrador') => {
    if (!lead || !emailOutreach) return
    const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
    await supabase.from('outreach_os').insert({
      lead_id: lead.id,
      usuario,
      asunto: emailOutreach.asunto,
      cuerpo: cuerpoEditado,
      estrategia,
      estado,
      ...(estado === 'enviado' ? { enviado_at: new Date().toISOString() } : {}),
    })
    if (estado === 'enviado') {
      await supabase.from('token_usage_os').insert({
        usuario,
        accion: 'email_enviado',
        tokens_estimados: 0,
      })
      setEmailsHoy((n) => n + 1)
      if (lead.propuesta_md || lead.propuesta_slides) {
        await actualizar({ fase: 'propuesta_enviada' })
      }
    }
  }

  const copiarEmail = async () => {
    if (!emailOutreach) return
    const texto = `Asunto: ${emailOutreach.asunto}\n\n${cuerpoEditado}\n\n${vendedor} · WIARE · info@wiaresolution.com`
    await navigator.clipboard.writeText(texto)
    await registrarEmailOutreach('enviado')
    toast('Email copiado al portapapeles', 'success')
  }

  const abrirMailto = async () => {
    if (!emailOutreach || !lead || !lead.email) return
    const firma = `${vendedor} · WIARE · info@wiaresolution.com`
    const cuerpoFull = `${cuerpoEditado}\n\n${firma}`
    const mailto = `mailto:${lead.email}?subject=${encodeURIComponent(emailOutreach.asunto)}&body=${encodeURIComponent(cuerpoFull)}`
    window.open(mailto, '_self')
    await registrarEmailOutreach('enviado')
    toast('Abriendo cliente de correo…', 'info')
  }

  const guardarBorrador = async () => {
    await registrarEmailOutreach('borrador')
    toast('Borrador guardado', 'success')
  }

  if (loading) {
    return (
      <PageTransition>
        <div style={{ marginBottom: 28 }}>
          <Skeleton.Line width={80} height={16} style={{ marginBottom: 16 }} />
          <Skeleton.Line width={280} height={28} />
        </div>
        <Skeleton.Detalle />
      </PageTransition>
    )
  }
  if (!lead) {
    return (
      <PageTransition>
        <p style={{ color: 'var(--color-error)', padding: 24 }}>
          Lead no encontrado{error ? `: ${error}` : ''}.
        </p>
      </PageTransition>
    )
  }

  const generarDemo = async () => {
    setGenerandoPrompt(true)
    setError('')
    try {
      const prompt = await generarSystemPrompt(lead)
      setPromptDraft(prompt)
      await actualizar({ system_prompt_sofia: prompt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando prompt')
    } finally {
      setGenerandoPrompt(false)
    }
  }

  const desplegarRetell = async () => {
    setDesplegando(true)
    setError('')
    try {
      const agentId = await crearAgentDemo(lead, promptDraft)
      await actualizar({
        agent_id_retell: agentId,
        system_prompt_sofia: promptDraft,
        fase: ['nuevo', 'cualificado'].includes(lead.fase) ? 'demo_creada' : lead.fase,
      })
      toast('Demo desplegada en Retell', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desplegando en Retell'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setDesplegando(false)
    }
  }

  const generarProp = async () => {
    setGenerandoPropuesta(true)
    setError('')
    try {
      const md = await generarPropuesta(lead)
      const updates: Record<string, unknown> = { propuesta_md: md }
      const fasesAnteriores = ['nuevo', 'cualificado', 'demo_creada']
      if (fasesAnteriores.includes(lead.fase)) updates.fase = 'propuesta_creada'
      await actualizar(updates)
      setPropuestaDraft(md)
      toast('Propuesta generada', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error generando propuesta'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGenerandoPropuesta(false)
    }
  }

  const guardarNotas = async () => {
    await actualizar({ notas })
    setNotasGuardadas(new Date().toLocaleTimeString('es-ES'))
  }

  const costes = calcularCostes(lead.mrr_estimado ?? 190)
  const mrr = lead.mrr_estimado ?? 190
  const margen = mrr - costes.total

  return (
    <PageTransition>
      {/* Header */}
      <div className="no-print" style={{ marginBottom: 28 }}>
        <button
          className="btn-ghost"
          onClick={() => navigate('/leads')}
          style={{ marginBottom: 16, paddingLeft: 0 }}
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{lead.nombre}</h1>
          <ScoreBadge score={lead.score_cualificacion} />
          <FuenteBadge fuente={lead.fuente} size="md" />
          <FaseSelector fase={lead.fase} onChange={cambiarFase} />
        </div>
      </div>

      {error && (
        <p className="no-print" style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} /> {error}
        </p>
      )}

      {/* Card especial: lead venido de la calculadora de wiaresolution.com */}
      {lead.fuente === 'web_calculadora' && lead.perdida_mensual_real != null && lead.perdida_mensual_real > 0 && (
        <div
          style={{
            background: 'rgba(34,197,94,0.04)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Globe size={16} color="#16A34A" weight="fill" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: '#16A34A' }}>
              Este lead vino de wiaresolution.com
            </span>
          </div>

          {/* Grid de métricas */}
          <div className="lead-web-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div style={metricaLabelStyle}>Pérdida mensual</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#EF4444' }}>
                {lead.perdida_mensual_real.toLocaleString('es-ES')}€
              </div>
            </div>
            <div>
              <div style={metricaLabelStyle}>Pérdida anual</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--color-text-secondary)' }}>
                {(lead.perdida_mensual_real * 12).toLocaleString('es-ES')}€
              </div>
            </div>
            <div>
              <div style={metricaLabelStyle}>Cada semana</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: '#F59E0B' }}>
                {Math.round(lead.perdida_mensual_real / 4).toLocaleString('es-ES')}€
              </div>
            </div>
            <div>
              <div style={metricaLabelStyle}>Payback WIARE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--color-primary)' }}>
                {Math.ceil(790 / (lead.perdida_mensual_real * 0.7))} semanas
              </div>
            </div>
          </div>

          {/* Nota táctica */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowRight size={12} color="#16A34A" />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#16A34A', fontFamily: 'var(--font-body)' }}>
              Ya sabe cuánto pierde — llámale hoy y tendrás ventaja total
            </span>
          </div>
        </div>
      )}

      <div className="detalle-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Columna izquierda — datos */}
        <div className="card no-print" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Datos del negocio</h2>
          {lead.direccion && (
            <DatoFila icon={MapPin} color="var(--color-primary)" label="Dirección">{lead.direccion}</DatoFila>
          )}
          {lead.telefono && (
            <DatoFila icon={Phone} color="var(--color-success)" label="Teléfono">
              <a href={`tel:${lead.telefono.replace(/\s/g, '')}`}>{lead.telefono}</a>
            </DatoFila>
          )}
          {lead.web && (
            <DatoFila icon={Globe} color="var(--color-cyan)" label="Web">
              <a href={lead.web} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{lead.web}</a>
            </DatoFila>
          )}

          {/* ── Email finder ── */}
          <DatoFila icon={EnvelopeSimple} color="var(--color-primary)" label="Email contacto">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Badge de estado */}
                {lead.email && lead.email_fuente && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 500,
                    background: lead.email_verificado ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: lead.email_verificado ? 'var(--color-success)' : 'var(--color-warning)',
                  }}>
                    {lead.email_verificado
                      ? <CheckCircle size={11} weight="fill" />
                      : <Warning size={11} weight="fill" />}
                    {labelFuente(lead.email_fuente as Parameters<typeof labelFuente>[0])}
                  </span>
                )}
                {!lead.email && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 500,
                    background: 'rgba(161,161,170,0.1)', color: 'var(--color-text-tertiary)',
                  }}>
                    <X size={11} weight="bold" /> Sin email
                  </span>
                )}
                <button
                  className="btn-ghost"
                  onClick={buscarEmailLead}
                  disabled={buscandoEmail}
                  style={{ fontSize: 12, padding: '4px 10px', minHeight: 28, gap: 4 }}
                >
                  <MagnifyingGlass size={12} />
                  {buscandoEmail ? 'Buscando…' : 'Buscar email'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="email@negocio.com"
                  style={{
                    flex: 1, fontSize: 13, padding: '6px 10px', minHeight: 32,
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-body)', outline: 'none',
                  }}
                />
                {emailDraft !== (lead.email ?? '') && emailDraft.trim() && (
                  <button
                    className="btn-primary"
                    onClick={guardarEmailManual}
                    style={{ fontSize: 12, padding: '4px 12px', minHeight: 32 }}
                  >
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </DatoFila>

          {lead.google_maps_url && (
            <DatoFila icon={MapPin} color="var(--color-error)" label="Ubicación">
              <a href={lead.google_maps_url} target="_blank" rel="noreferrer">Ver en Google Maps</a>
            </DatoFila>
          )}
          <DatoFila icon={Star} color="var(--color-warning)" label="Reputación">
            {lead.valoracion ?? '—'} · {lead.num_resenas ?? 0} reseñas
          </DatoFila>
          {lead.horario && lead.horario.length > 0 && (
            <DatoFila icon={Clock} color="var(--color-text-secondary)" label="Horario">
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {lead.horario.map((h, i) => <div key={i}>{h}</div>)}
              </div>
            </DatoFila>
          )}
          <DatoFila icon={CurrencyEur} color="var(--color-success)" label="MRR estimado">
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              {lead.mrr_estimado != null ? `${lead.mrr_estimado}€/mes` : 'Sin cualificar'}
            </span>
          </DatoFila>
          {lead.motivo_score && (
            <DatoFila icon={Note} color="var(--color-primary)" label="Motivo score">
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{lead.motivo_score}</span>
            </DatoFila>
          )}
          {lead.volumen_llamadas && (
            <DatoFila icon={Phone} color="var(--color-text-secondary)" label="Volumen llamadas">
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{lead.volumen_llamadas}</span>
            </DatoFila>
          )}
          {lead.descripcion && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingTop: 12, lineHeight: 1.5 }}>
              {lead.descripcion}
            </p>
          )}
        </div>

        {/* Columna derecha — tabs */}
        <div>
          {/* Tabs lineales */}
          <div
            className="no-print detalle-tabs"
            role="tablist"
            aria-label="Secciones del lead"
            style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}
          >
            {TABS.map(({ id: t, label, icon: Icon }) => {
              const activo = tab === t
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={activo}
                  id={`tab-${t}`}
                  aria-controls="tabpanel-detalle"
                  onClick={() => setTab(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    fontSize: 14,
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activo ? '2px solid var(--color-primary)' : '2px solid transparent',
                    color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    marginBottom: -1,
                    borderRadius: 0,
                    minHeight: 'auto',
                    transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <Icon size={14} weight={activo ? 'fill' : 'regular'} /> {label}
                </button>
              )
            })}
          </div>

          <div className="card" id="tabpanel-detalle" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ padding: 28 }}>
            {/* ── TAB DEMO ── */}
            {tab === 'demo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {lead.agent_id_retell ? (
                  <>
                    <div
                      style={{
                        background: 'rgba(34,197,94,0.06)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={20} weight="fill" style={{ color: 'var(--color-success)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>Demo activa</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>
                        Agent ID: {lead.agent_id_retell}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        Abre el dashboard de Retell AI, asigna un número al agente o usa la llamada web de prueba para probar la demo de Sofía.
                        {lead.telefono && <> Para la demo comercial, llama al <strong style={{ color: 'var(--color-text-primary)' }}>{lead.telefono}</strong>.</>}
                      </p>
                    </div>
                    <button className="btn-secondary" onClick={generarDemo} disabled={generandoPrompt} style={{ alignSelf: 'flex-start' }}>
                      <ArrowClockwise size={16} /> {generandoPrompt ? 'Regenerando…' : 'Regenerar'}
                    </button>
                    {promptDraft && lead.system_prompt_sofia !== promptDraft && (
                      <>
                        <textarea className="prompt-textarea" value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} style={promptTextareaStyle} />
                        <button className="btn-primary" onClick={desplegarRetell} disabled={desplegando} style={{ alignSelf: 'flex-start' }}>
                          <Broadcast size={16} /> {desplegando ? 'Desplegando…' : 'Desplegar en Retell'}
                        </button>
                      </>
                    )}
                  </>
                ) : promptDraft ? (
                  <>
                    <h2 style={{ fontSize: 17 }}>System prompt de Sofía</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Revisa y edita antes de desplegar.</p>
                    <textarea className="prompt-textarea" value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} style={promptTextareaStyle} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn-primary" onClick={desplegarRetell} disabled={desplegando}>
                        <Broadcast size={16} /> {desplegando ? 'Desplegando…' : 'Desplegar en Retell'}
                      </button>
                      <button className="btn-secondary" onClick={generarDemo} disabled={generandoPrompt}>
                        <ArrowClockwise size={16} /> {generandoPrompt ? 'Generando…' : 'Regenerar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 style={{ fontSize: 17 }}>Demo de voz con Sofía</h2>
                    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                      Genera un system prompt personalizado para {lead.nombre} y despliégalo como agente de voz en Retell AI.
                    </p>
                    <button className="btn-primary detalle-btn-full" onClick={generarDemo} disabled={generandoPrompt} style={{ alignSelf: 'flex-start' }}>
                      <Waveform size={16} /> {generandoPrompt ? 'Generando con Claude…' : 'Generar demo'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── TAB PROPUESTA ── */}
            {tab === 'propuesta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Selector Texto / Slides */}
                {(lead.propuesta_md || lead.propuesta_slides) && (
                  <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                    {(['texto', 'slides'] as const).map((modo) => (
                      <button
                        key={modo}
                        onClick={() => setModoPropuesta(modo)}
                        style={{
                          padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                          background: modoPropuesta === modo ? 'var(--color-primary-subtle)' : 'transparent',
                          color: modoPropuesta === modo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          border: modoPropuesta === modo ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                          minHeight: 'auto',
                          transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                        }}
                      >
                        {modo === 'texto' ? 'Texto' : 'Slides'}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Modo TEXTO ── */}
                {modoPropuesta === 'texto' && (
                  <>
                    {lead.propuesta_md ? (
                      <>
                        {editandoPropuesta ? (
                          <>
                            <textarea value={propuestaDraft} onChange={(e) => setPropuestaDraft(e.target.value)} style={{ ...promptTextareaStyle, minHeight: 400 }} />
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button
                                className="btn-primary"
                                onClick={async () => { await actualizar({ propuesta_md: propuestaDraft }); setEditandoPropuesta(false) }}
                              >
                                Guardar
                              </button>
                              <button className="btn-secondary" onClick={() => setEditandoPropuesta(false)}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <PropuestaViewer
                              markdown={lead.propuesta_md}
                              nombreNegocio={lead.nombre}
                              onMarcarEnviada={
                                lead.fase !== 'propuesta_enviada' && lead.fase !== 'cerrado'
                                  ? () => actualizar({ fase: 'propuesta_enviada' })
                                  : undefined
                              }
                            />
                            <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                              <button className="btn-secondary" onClick={() => { setPropuestaDraft(lead.propuesta_md ?? ''); setEditandoPropuesta(true) }}>
                                <PencilSimple size={16} /> Editar
                              </button>
                              <button className="btn-secondary" onClick={generarProp} disabled={generandoPropuesta}>
                                <ArrowClockwise size={16} /> {generandoPropuesta ? 'Regenerando…' : 'Regenerar'}
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 style={{ fontSize: 17 }}>Propuesta comercial</h2>
                        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                          Genera una propuesta personalizada con ROI calculado para {lead.nombre}.
                        </p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button className="btn-primary" onClick={generarProp} disabled={generandoPropuesta} style={{ alignSelf: 'flex-start' }}>
                            <FileText size={16} /> {generandoPropuesta ? 'Generando con Claude…' : 'Generar propuesta texto'}
                          </button>
                          <button className="btn-secondary" onClick={generarSlides} disabled={generandoSlides} style={{ alignSelf: 'flex-start' }}>
                            <ArrowClockwise size={16} /> {generandoSlides ? 'Generando slides…' : 'Generar slides'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── Modo SLIDES ── */}
                {modoPropuesta === 'slides' && (
                  <>
                    {lead.propuesta_slides ? (
                      <>
                        <PropuestaSlides
                          slides={lead.propuesta_slides as unknown as SlidesContent}
                          nombreNegocio={lead.nombre}
                        />
                        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                          <button className="btn-secondary" onClick={generarSlides} disabled={generandoSlides}>
                            <ArrowClockwise size={16} /> {generandoSlides ? 'Regenerando…' : 'Regenerar slides'}
                          </button>
                          {lead.fase !== 'propuesta_enviada' && lead.fase !== 'cerrado' && (
                            <button className="btn-secondary" onClick={() => actualizar({ fase: 'propuesta_enviada' })}>
                              <CheckCircle size={16} /> Marcar como enviada
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 style={{ fontSize: 17 }}>Propuesta en slides</h2>
                        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                          Genera un deck visual de 7 slides personalizado para {lead.nombre}.
                        </p>
                        <button className="btn-primary" onClick={generarSlides} disabled={generandoSlides} style={{ alignSelf: 'flex-start' }}>
                          <FileText size={16} /> {generandoSlides ? 'Generando slides…' : 'Generar slides'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── TAB COSTES ── */}
            {tab === 'costes' && (
              <div>
                <h2 style={{ fontSize: 17, marginBottom: 16 }}>Costes internos mensuales</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <tbody>
                    {[
                      ['Retell AI', `${costes.retell}€`],
                      ['ElevenLabs', `${costes.elevenlabs}€`],
                      ['Supabase', `${costes.supabase}€`],
                      ['Twilio +34', `${costes.twilio}€`],
                    ].map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 0' }}>{k}</td>
                        <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500 }}>{v}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600 }}>Total costes</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>{costes.total}€</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600 }}>MRR cliente</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{mrr}€</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 0', fontWeight: 700 }}>Margen</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: margen > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {margen}€ ({Math.round((margen / mrr) * 100)}%)
                      </td>
                    </tr>
                  </tbody>
                </table>
                {lead.mrr_estimado == null && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 14 }}>
                    Lead sin cualificar — cálculo con MRR por defecto de 190€.
                  </p>
                )}
              </div>
            )}

            {/* ── TAB NOTAS ── */}
            {tab === 'notas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ fontSize: 17 }}>Notas</h2>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  onBlur={guardarNotas}
                  placeholder="Apuntes de llamadas, objeciones, próximos pasos…"
                  style={{ width: '100%', minHeight: 240, resize: 'vertical', borderRadius: 'var(--radius-md)', padding: 16, fontSize: 14, lineHeight: 1.6 }}
                />
                {notasGuardadas && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Guardado a las {notasGuardadas}</p>
                )}
              </div>
            )}

            {/* ── TAB EMAIL OUTREACH ── */}
            {tab === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Aviso límite blando */}
                {emailsHoy >= DAILY_EMAIL_LIMIT && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13,
                    color: 'var(--color-warning)',
                  }}>
                    <Warning size={15} weight="fill" />
                    Has enviado {emailsHoy} emails hoy (recomendado: {DAILY_EMAIL_LIMIT}/día)
                  </div>
                )}

                {/* ── PASO 1: Estrategia ── */}
                {outreachStep === 'idle' && (
                  <>
                    <div>
                      <h2 style={{ fontSize: 17, marginBottom: 6 }}>Email Outreach</h2>
                      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                        Analiza el perfil de {lead.nombre} y genera un email personalizado listo para enviar.
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={crearEstrategia}
                      disabled={generandoEstrategia}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <Brain size={16} />
                      {generandoEstrategia ? 'Analizando…' : 'Analizar y crear estrategia'}
                    </button>
                    {generandoEstrategia && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '80%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '45%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </div>
                    )}
                  </>
                )}

                {/* ── PASO 1 resultado: estrategia cards ── */}
                {outreachStep === 'estrategia' && estrategia && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Ángulo', value: estrategia.angulo },
                        { label: 'Dolor elegido', value: estrategia.dolor_elegido },
                        { label: 'Dato específico', value: estrategia.dato_especifico },
                        { label: 'Urgencia', value: estrategia.urgencia },
                      ].map(({ label, value }) => (
                        <div key={label} style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tono badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Tono:</span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
                        background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                        textTransform: 'capitalize',
                      }}>
                        {estrategia.tono}
                      </span>
                    </div>

                    {/* Asuntos seleccionables */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                        Elige asunto
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {estrategia.opciones_asunto.map((asunto, i) => (
                          <button
                            key={i}
                            onClick={() => setAsuntoSeleccionado(i)}
                            style={{
                              textAlign: 'left', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13,
                              border: asuntoSeleccionado === i ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: asuntoSeleccionado === i ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                              color: asuntoSeleccionado === i ? 'var(--color-primary)' : 'var(--color-text-primary)',
                              fontWeight: asuntoSeleccionado === i ? 600 : 400,
                              minHeight: 'auto', transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                            }}
                          >
                            {asunto}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-primary" onClick={crearEmail} disabled={generandoEmail}>
                        <EnvelopeSimple size={16} />
                        {generandoEmail ? 'Generando email…' : 'Generar email'}
                      </button>
                      <button className="btn-ghost" onClick={() => setOutreachStep('idle')}>
                        <ArrowClockwise size={16} /> Nueva estrategia
                      </button>
                    </div>
                  </>
                )}

                {/* ── PASO 2: Email preview ── */}
                {outreachStep === 'email' && emailOutreach && (
                  <>
                    {/* Card oscura tipo bandeja */}
                    <div style={{
                      background: '#0f1117',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 24,
                      display: 'flex', flexDirection: 'column', gap: 16,
                    }}>
                      {[
                        { label: 'De', value: `info@wiaresolution.com` },
                        { label: 'Para', value: lead.email ?? '(sin email guardado)' },
                        { label: 'Asunto', value: emailOutreach.asunto },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', width: 52, flexShrink: 0, paddingTop: 1 }}>{label}</span>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{value}</span>
                        </div>
                      ))}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Cuerpo</div>
                        <textarea
                          value={cuerpoEditado}
                          onChange={(e) => setCuerpoEditado(e.target.value)}
                          style={{
                            width: '100%', minHeight: 160, resize: 'vertical',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 13,
                            color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, fontFamily: 'var(--font-body)',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>Firmante</span>
                          <select
                            value={vendedor}
                            onChange={(e) => setVendedor(e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 12,
                              color: 'rgba(255,255,255,0.7)', cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value="Jacobo">Jacobo</option>
                            <option value="Luis">Luis</option>
                          </select>
                        </div>
                        {vendedor} · WIARE · info@wiaresolution.com
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn-primary" onClick={copiarEmail}>
                        <Copy size={16} /> Copiar email completo
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={abrirMailto}
                        disabled={!lead.email}
                        title={!lead.email ? 'Guarda primero el email del lead' : undefined}
                      >
                        <PaperPlane size={16} /> Abrir en mi correo
                      </button>
                      <button className="btn-ghost" onClick={guardarBorrador}>
                        <FloppyDisk size={16} /> Guardar borrador
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" onClick={() => setOutreachStep('estrategia')} style={{ fontSize: 12 }}>
                        ← Cambiar asunto
                      </button>
                      <button className="btn-ghost" onClick={() => setOutreachStep('idle')} style={{ fontSize: 12 }}>
                        Empezar de nuevo
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
