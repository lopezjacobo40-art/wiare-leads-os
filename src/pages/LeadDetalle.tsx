import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Microphone, FileText, CurrencyEur, Note,
  Phone, Globe, MapPin, Star, Clock,
  Waveform, Broadcast, ArrowClockwise, CheckCircle, PencilSimple,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { generarSystemPrompt, generarPropuesta } from '../lib/claudeApi'
import { crearAgentDemo } from '../lib/retellApi'
import ScoreBadge from '../components/ScoreBadge'
import PropuestaViewer from '../components/PropuestaViewer'
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

type Tab = 'demo' | 'propuesta' | 'costes' | 'notas'

const TABS: { id: Tab; label: string; icon: typeof Microphone }[] = [
  { id: 'demo', label: 'Demo Retell', icon: Microphone },
  { id: 'propuesta', label: 'Propuesta', icon: FileText },
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

  // notas
  const [notas, setNotas] = useState('')
  const [notasGuardadas, setNotasGuardadas] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('leads_os')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else {
          const l = data as Lead
          setLead(l)
          setNotas(l.notas ?? '')
          setPromptDraft(l.system_prompt_sofia ?? '')
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

  const cambiarFase = async (fase: string) => {
    if (!lead || fase === lead.fase) return
    await actualizar({ fase })
    toast(`Fase: ${FASE_LABELS[fase] ?? fase}`, 'success')
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
    return <p style={{ color: 'var(--color-error)' }}>Lead no encontrado. {error}</p>
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
      await actualizar({ propuesta_md: md })
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
          <FaseSelector fase={lead.fase} onChange={cambiarFase} />
        </div>
      </div>

      {error && (
        <p className="no-print" style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} /> {error}
        </p>
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
                    <button className="btn-primary detalle-btn-full" onClick={generarProp} disabled={generandoPropuesta} style={{ alignSelf: 'flex-start' }}>
                      <FileText size={16} /> {generandoPropuesta ? 'Generando con Claude…' : 'Generar propuesta'}
                    </button>
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
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
