import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, CurrencyEur, Note,
  Phone, Globe, MapPin, Star, Clock,
  ArrowClockwise, CheckCircle, ArrowRight, MagnifyingGlassPlus,
  EnvelopeSimple, MagnifyingGlass, Warning, X, Copy, Lightbulb,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { analizarBrechas, toAnalisisBrechas } from '../lib/claudeApi'
import { fetchWithAudit } from '../lib/apiAuditor'
import { labelFuente } from '../lib/emailFinder'
import ScoreBadge from '../components/ScoreBadge'
import FuenteBadge from '../components/FuenteBadge'
import FaseSelector from '../components/FaseSelector'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'

// Fila de dato del negocio: icono semántico + label uppercase + valor, separadas por border-bottom.
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

type Tab = 'informe' | 'costes' | 'notas'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'informe', label: 'Informe de brechas', icon: FileText },
  { id: 'costes', label: 'Costes', icon: CurrencyEur },
  { id: 'notas', label: 'Notas', icon: Note },
]

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

export default function LeadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('informe')
  const [error, setError] = useState('')

  // análisis de brechas
  const [analizando, setAnalizando] = useState(false)

  // email
  const [buscandoEmail, setBuscandoEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [marcandoEnviado, setMarcandoEnviado] = useState(false)

  // notas
  const [notas, setNotas] = useState('')
  const [notasGuardadas, setNotasGuardadas] = useState<string | null>(null)

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

  const analizar = async () => {
    if (!lead) return
    setAnalizando(true)
    setError('')
    try {
      const r = await analizarBrechas(lead)
      await actualizar({
        score_cualificacion: r.score,
        motivo_score: r.resumen,
        volumen_llamadas: r.volumen,
        mrr_estimado: r.mrr,
        analisis_brechas: toAnalisisBrechas(r),
        analizado_at: new Date().toISOString(),
        fase: lead.fase === 'nuevo' ? 'negocio_analizado' : lead.fase,
        icebreaker: r.icebreaker,
      })
      toast('Brechas analizadas', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error analizando brechas'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setAnalizando(false)
    }
  }

  const buscarEmailLead = async () => {
    if (!lead) return
    setBuscandoEmail(true)
    try {
      const res = await fetchWithAudit('/api/find-email', {
        method: 'POST',
        service: 'Hunter',
        retries: 2,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web: lead.web, descripcion: lead.descripcion, nombre: lead.nombre }),
      })
      const data = res.ok ? await res.json() : { email: null }
      const email = data.email ?? null
      const fuente = data.fuente ?? 'sin_email'
      const decisor = data.decisor ?? null

      if (email || decisor) {
        const updates: Partial<Lead> = {}
        if (email) {
          updates.email = email
          updates.email_fuente = fuente
          updates.email_verificado = true
          setEmailDraft(email)
        }
        if (decisor) {
          updates.decisor_nombre = decisor.nombre
          updates.decisor_cargo = decisor.cargo
          updates.decisor_linkedin = decisor.linkedin
        }

        await actualizar(updates)

        if (email && decisor) {
          toast(`Email encontrado: ${email} (CEO: ${decisor.nombre})`, 'success')
        } else if (email) {
          toast(`Email encontrado: ${email}`, 'success')
        } else if (decisor) {
          toast(`CEO encontrado: ${decisor.nombre}`, 'success')
        }
      } else {
        toast('No se encontró información en su web', 'info')
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

  // Listo para enviar → pasa la fase a 'listo_para_enviar'.
  const marcarListoParaEnviar = async () => {
    if (!lead) return
    await actualizar({ fase: 'listo_para_enviar' })
    toast('Listo para enviar', 'success')
  }

  // Abre el redactor de Gmail con el destinatario y plantilla prerrellenada.
  const abrirGmail = () => {
    if (!lead?.email) return

    let finalSubject = ''
    let finalBody = ''

    if (lead.analisis_brechas?.email_asunto && lead.analisis_brechas?.email_cuerpo) {
      finalSubject = lead.analisis_brechas.email_asunto
      finalBody = lead.analisis_brechas.email_cuerpo
    } else {
      const defaultSubject = 'pregunta rápida'
      const defaultBody = `Hola {{nombre_decisor}}, soy Jacobo, cofundador de WIARE.

Me he fijado en {{nombre_negocio}} porque tenéis excelentes reseñas en {{ciudad}} pero vuestro horario de atención es limitado.

{{puntos}}

Si te cuadra, ¿te puedo pasar un audio de 30 segundos por WhatsApp para que escuches cómo sonaría tu recepcionista automática contestando con el nombre de {{nombre_negocio}}?

Un saludo, Jacobo.`

      const subjectTemplate = localStorage.getItem('email_template_subject') || defaultSubject
      const bodyTemplate = localStorage.getItem('email_template_body') || defaultBody

      const nombreDecisor = lead.decisor_nombre ? lead.decisor_nombre.split(' ')[0] : 'propietario'
      const icebreaker = lead.icebreaker || `Hola ${nombreDecisor}, vi vuestro negocio ${lead.nombre} y me pareció muy interesante.`
      const puntosFormat = (lead.analisis_brechas?.puntos_email || []).join('\n\n')

      finalSubject = subjectTemplate
        .replace(/{{nombre_negocio}}/g, lead.nombre)
        .replace(/{{nombre_decisor}}/g, nombreDecisor)
        .replace(/{{ciudad}}/g, lead.ciudad || 'tu ciudad')

      finalBody = bodyTemplate
        .replace(/{{nombre_negocio}}/g, lead.nombre)
        .replace(/{{nombre_decisor}}/g, nombreDecisor)
        .replace(/{{ciudad}}/g, lead.ciudad || 'tu ciudad')
        .replace(/{{icebreaker}}/g, icebreaker)
        .replace(/{{puntos}}/g, puntosFormat || '- Sin puntos detectados')
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalBody)}`
    window.open(gmailUrl, '_blank')
  }

  // Marca el email como enviado: fase 'email_enviado' + registra para el contador diario.
  const marcarEnviado = async () => {
    if (!lead) return
    setMarcandoEnviado(true)
    const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
    try {
      await supabase.from('token_usage_os').insert({ usuario, accion: 'email_enviado', tokens_estimados: 0 })
      await actualizar({ fase: 'email_enviado' })
      toast('Marcado como enviado', 'success')
    } catch {
      toast('Error al marcar como enviado', 'error')
    } finally {
      setMarcandoEnviado(false)
    }
  }

  const copiar = async (texto: string, etiqueta: string) => {
    await navigator.clipboard.writeText(texto)
    toast(`${etiqueta} copiado`, 'info')
  }

  const guardarNotas = async () => {
    await actualizar({ notas })
    setNotasGuardadas(new Date().toLocaleTimeString('es-ES'))
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

  const analisis = lead.analisis_brechas
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Globe size={16} color="#16A34A" weight="fill" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: '#16A34A' }}>
              Este lead vino de wiaresolution.com
            </span>
          </div>
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
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowRight size={12} color="#16A34A" />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#16A34A', fontFamily: 'var(--font-body)' }}>
              Ya sabe cuánto pierde — contáctale hoy y tendrás ventaja total
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

          {/* ── Email de contacto + cascada ── */}
          <DatoFila icon={EnvelopeSimple} color="var(--color-primary)" label="Email contacto">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
              {/* Sin email real — badge informativo */}
              {!lead.email && lead.email_fuente === 'sin_email' && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  background: 'rgba(161,161,170,0.08)', border: '1px solid rgba(161,161,170,0.2)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 11,
                  color: 'var(--color-text-tertiary)', lineHeight: 1.4,
                }}>
                  <Warning size={13} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>No se encontró ningún email real en su web. Puedes añadirlo manualmente o dejarlo sin email.</span>
                </div>
              )}
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
                  <button className="btn-primary" onClick={guardarEmailManual} style={{ fontSize: 12, padding: '4px 12px', minHeight: 32 }}>
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
          {Array.isArray(lead.horario) && lead.horario.length > 0 && (
            <DatoFila icon={Clock} color="var(--color-text-secondary)" label="Horario">
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {lead.horario.map((h, i) => <div key={i}>{String(h)}</div>)}
              </div>
            </DatoFila>
          )}
          <DatoFila icon={CurrencyEur} color="var(--color-success)" label="MRR estimado">
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              {lead.mrr_estimado != null ? `${lead.mrr_estimado}€/mes` : 'Sin analizar'}
            </span>
          </DatoFila>
          {lead.descripcion && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingTop: 12, lineHeight: 1.5 }}>
              {lead.descripcion}
            </p>
          )}
        </div>

        {/* Columna derecha — tabs */}
        <div>
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
            {/* ── TAB INFORME ── */}
            {tab === 'informe' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {!analisis ? (
                  <>
                    <div>
                      <h2 style={{ fontSize: 17, marginBottom: 6 }}>Análisis de brechas</h2>
                      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                        Analiza qué pierde {lead.nombre} hoy y qué puede ahorrarle WIARE. Obtendrás un informe + 3 puntos listos para tu email.
                      </p>
                    </div>
                    <button className="btn-primary" onClick={analizar} disabled={analizando} style={{ alignSelf: 'flex-start' }}>
                      <MagnifyingGlassPlus size={16} /> {analizando ? 'Analizando con Claude…' : 'Analizar brechas'}
                    </button>
                    {analizando && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '90%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 4, width: '55%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Ahorro estimado — INTERNO. Es una estimación orientativa de la IA
                        a partir de datos públicos (reseñas, horario); NO una cifra calculada.
                        No citarla al cliente como dato concreto: se hunde en la 1ª llamada. */}
                    {analisis.ahorro_estimado && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', padding: '10px 14px',
                      }}>
                        <CurrencyEur size={16} weight="bold" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}>
                            Orientativo interno · no citar al cliente
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {analisis.ahorro_estimado}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Badge de recomendación (v7 Gemini) */}
                    {analisis?.recomendacion && (() => {
                      const cfg = {
                        contactar: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', label: 'Contactar' },
                        dudoso:    { bg: 'rgba(245,158,11,0.1)', color: '#D97706', label: 'Dudoso' },
                        descartar: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Descartar' },
                      }[analisis.recomendacion]
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                            padding: '4px 12px', borderRadius: 'var(--radius-full)',
                            fontSize: 13, fontWeight: 600,
                            background: cfg.bg, color: cfg.color,
                          }}>
                            {cfg.label}
                          </span>
                          {analisis.encaje && (
                            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                              {analisis.encaje}
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Resumen (informe) */}
                    {lead.motivo_score && (
                      <div>
                        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Informe</h2>
                        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
                          {lead.motivo_score}
                        </p>
                      </div>
                    )}

                    {/* Brechas detectadas */}
                    {analisis.brechas.length > 0 && (
                      <div>
                        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Brechas detectadas</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {analisis.brechas.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <Warning size={16} weight="fill" style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                              <span style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3 puntos para el email */}
                    {analisis.puntos_email.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                          <h2 style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Lightbulb size={16} weight="fill" style={{ color: 'var(--color-primary)' }} />
                            3 puntos para tu email
                          </h2>
                          <button
                            className="btn-primary"
                            onClick={() => copiar(analisis.puntos_email.map((p, i) => `${i + 1}. ${p}`).join('\n'), 'Los 3 puntos')}
                            style={{ fontSize: 13, padding: '6px 14px', minHeight: 34 }}
                          >
                            <Copy size={15} /> Copiar los 3 puntos
                          </button>
                        </div>
                        <div style={{
                          background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
                        }}>
                          {analisis.puntos_email.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <span style={{
                                fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--color-primary)',
                                borderRadius: 'var(--radius-full)', width: 22, height: 22, flexShrink: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                              }}>{i + 1}</span>
                              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55 }}>{p}</span>
                              <button
                                onClick={() => copiar(p, 'Punto')}
                                title="Copiar punto"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
                          Pega estos puntos en tu plantilla de email del nicho. El email lo redactas tú.
                        </p>
                      </div>
                    )}

                    {/* Acciones del funnel */}
                    <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                      {lead.fase === 'negocio_analizado' && (
                        <button className="btn-secondary" onClick={marcarListoParaEnviar}>
                          <CheckCircle size={16} /> Listo para enviar
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        onClick={abrirGmail}
                        disabled={!lead.email}
                        title={!lead.email ? 'Email no disponible' : undefined}
                      >
                        <EnvelopeSimple size={16} /> Abrir Gmail
                      </button>
                      {lead.fase !== 'email_enviado' && (
                        <button
                          className="btn-primary"
                          onClick={marcarEnviado}
                          disabled={marcandoEnviado || lead.fase === 'nuevo'}
                          title={lead.fase === 'nuevo' ? 'Analiza y confirma brechas antes' : undefined}
                          style={{ background: 'var(--color-success)' }}
                        >
                          <CheckCircle size={16} /> {marcandoEnviado ? 'Marcando…' : 'Marcar como enviado'}
                        </button>
                      )}
                      <button className="btn-ghost" onClick={analizar} disabled={analizando}>
                        <ArrowClockwise size={16} /> {analizando ? 'Reanalizando…' : 'Reanalizar'}
                      </button>
                    </div>
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
                    Negocio sin analizar — cálculo con MRR por defecto de 190€.
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
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
