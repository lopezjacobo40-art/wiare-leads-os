import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Microphone, FileText, CurrencyEur, Note,
  Phone, Globe, MapPin, Star, Clock,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASES, FASE_LABELS } from '../lib/supabaseClient'
import { generarSystemPrompt, generarPropuesta } from '../lib/claudeApi'
import { crearAgentDemo } from '../lib/retellApi'
import ScoreBadge from '../components/ScoreBadge'

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

// Render mínimo de Markdown a HTML (sin librerías externas)
function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = esc.split('\n')
  let html = ''
  let inTable = false
  let inList = false
  const inline = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')

  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) continue
      const cells = line.split('|').slice(1, -1).map((c) => inline(c.trim()))
      if (!inTable) { html += '<table>'; inTable = true; html += `<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`; continue }
      html += `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`
      continue
    }
    if (inTable) { html += '</table>'; inTable = false }
    if (/^[-*] /.test(line.trim())) {
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${inline(line.trim().slice(2))}</li>`
      continue
    }
    if (inList) { html += '</ul>'; inList = false }
    if (line.startsWith('### ')) html += `<h3>${inline(line.slice(4))}</h3>`
    else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>`
    else if (line.startsWith('# ')) html += `<h1>${inline(line.slice(2))}</h1>`
    else if (line.trim() === '') html += ''
    else html += `<p>${inline(line)}</p>`
  }
  if (inTable) html += '</table>'
  if (inList) html += '</ul>'
  return html
}

export default function LeadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
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
    if (err) { setError(err.message); return }
    setLead({ ...lead, ...campos })
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><div className="spinner" /></div>
  }
  if (!lead) {
    return <p style={{ color: 'var(--red)' }}>Lead no encontrado. {error}</p>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desplegando en Retell')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando propuesta')
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

  const datoStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5 }
  const iconStyle = { color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }

  return (
    <div>
      <button className="btn-ghost no-print" onClick={() => navigate('/leads')} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26 }}>{lead.nombre}</h1>
        <ScoreBadge score={lead.score_cualificacion} />
        <select
          value={lead.fase}
          onChange={(e) => actualizar({ fase: e.target.value })}
          style={{ minHeight: 40, padding: '6px 12px' }}
        >
          {FASES.map((f) => <option key={f} value={f}>{FASE_LABELS[f]}</option>)}
        </select>
      </div>

      {error && <p className="no-print" style={{ color: 'var(--red)', fontSize: 14, marginBottom: 16 }}>⚠️ {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Columna izquierda — datos */}
        <div className="card no-print" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Datos del negocio</h2>
          {lead.direccion && <div style={datoStyle}><MapPin size={17} style={iconStyle} /> {lead.direccion}</div>}
          {lead.telefono && (
            <div style={datoStyle}><Phone size={17} style={iconStyle} /> <a href={`tel:${lead.telefono.replace(/\s/g, '')}`}>{lead.telefono}</a></div>
          )}
          {lead.web && (
            <div style={datoStyle}><Globe size={17} style={iconStyle} /> <a href={lead.web} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{lead.web}</a></div>
          )}
          {lead.google_maps_url && (
            <div style={datoStyle}><MapPin size={17} style={iconStyle} /> <a href={lead.google_maps_url} target="_blank" rel="noreferrer">Ver en Google Maps</a></div>
          )}
          <div style={datoStyle}>
            <Star size={17} style={iconStyle} />
            <span>⭐ {lead.valoracion ?? '—'} · {lead.num_resenas ?? 0} reseñas</span>
          </div>
          {lead.horario && lead.horario.length > 0 && (
            <div style={datoStyle}>
              <Clock size={17} style={iconStyle} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {lead.horario.map((h, i) => <div key={i}>{h}</div>)}
              </div>
            </div>
          )}
          {lead.descripcion && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {lead.descripcion}
            </p>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13 }}>
              <strong>MRR estimado:</strong>{' '}
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{lead.mrr_estimado != null ? `${lead.mrr_estimado}€/mes` : 'Sin cualificar'}</span>
            </p>
            {lead.motivo_score && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}><strong>Motivo score:</strong> {lead.motivo_score}</p>
            )}
            {lead.volumen_llamadas && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}><strong>Volumen llamadas:</strong> {lead.volumen_llamadas}</p>
            )}
          </div>
        </div>

        {/* Columna derecha — tabs */}
        <div>
          <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map(({ id: t, label, icon: Icon }) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  background: tab === t ? 'var(--accent-primary)' : '#fff',
                  color: tab === t ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <Icon size={17} weight="duotone" /> {label}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 28 }}>
            {tab === 'demo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {lead.agent_id_retell ? (
                  <>
                    <h2 style={{ fontSize: 17 }}>✅ Demo lista</h2>
                    <p style={{ fontSize: 14 }}>
                      Agent ID: <code style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: 6, fontSize: 13 }}>{lead.agent_id_retell}</code>
                    </p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      Abre el dashboard de Retell AI, asigna un número al agente o usa la llamada web de prueba para probar la demo de Sofía.
                      {lead.telefono && <> Para la demo comercial, llama desde el móvil del cliente: <strong>{lead.telefono}</strong>.</>}
                    </p>
                    <button className="btn-ghost" onClick={generarDemo} disabled={generandoPrompt} style={{ alignSelf: 'flex-start' }}>
                      {generandoPrompt ? 'Regenerando…' : 'Regenerar demo'}
                    </button>
                    {promptDraft && lead.system_prompt_sofia !== promptDraft && (
                      <>
                        <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={14} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
                        <button className="btn-gradient" onClick={desplegarRetell} disabled={desplegando} style={{ alignSelf: 'flex-start' }}>
                          {desplegando ? 'Desplegando…' : 'Desplegar en Retell AI'}
                        </button>
                      </>
                    )}
                  </>
                ) : promptDraft ? (
                  <>
                    <h2 style={{ fontSize: 17 }}>System prompt de Sofía</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Revisa y edita antes de desplegar.</p>
                    <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={16} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-gradient" onClick={desplegarRetell} disabled={desplegando}>
                        {desplegando ? 'Desplegando…' : 'Desplegar en Retell AI'}
                      </button>
                      <button className="btn-ghost" onClick={generarDemo} disabled={generandoPrompt}>
                        {generandoPrompt ? 'Generando…' : 'Regenerar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 style={{ fontSize: 17 }}>Demo de voz con Sofía</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      Genera un system prompt personalizado para {lead.nombre} y despliégalo como agente de voz en Retell AI.
                    </p>
                    <button className="btn-gradient" onClick={generarDemo} disabled={generandoPrompt} style={{ alignSelf: 'flex-start' }}>
                      {generandoPrompt ? 'Generando con Claude…' : '🎙️ Generar demo personalizada'}
                    </button>
                  </>
                )}
              </div>
            )}

            {tab === 'propuesta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {lead.propuesta_md ? (
                  <>
                    <img src="/logo-wiare.png" alt="WIARE" className="print-logo" />
                    {editandoPropuesta ? (
                      <>
                        <textarea value={propuestaDraft} onChange={(e) => setPropuestaDraft(e.target.value)} rows={20} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            className="btn-gradient"
                            onClick={async () => { await actualizar({ propuesta_md: propuestaDraft }); setEditandoPropuesta(false) }}
                          >
                            Guardar
                          </button>
                          <button className="btn-ghost" onClick={() => setEditandoPropuesta(false)}>Cancelar</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="propuesta-md"
                          style={{ fontSize: 14, lineHeight: 1.65 }}
                          dangerouslySetInnerHTML={{ __html: mdToHtml(lead.propuesta_md) }}
                        />
                        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                          <button className="btn-ghost" onClick={() => { setPropuestaDraft(lead.propuesta_md ?? ''); setEditandoPropuesta(true) }}>✏️ Editar</button>
                          <button className="btn-ghost" onClick={() => window.print()}>⬇️ Descargar PDF</button>
                          {lead.fase !== 'propuesta_enviada' && lead.fase !== 'cerrado' && (
                            <button className="btn-gradient" onClick={() => actualizar({ fase: 'propuesta_enviada' })}>✅ Marcar como enviada</button>
                          )}
                          <button className="btn-ghost" onClick={generarProp} disabled={generandoPropuesta}>
                            {generandoPropuesta ? 'Regenerando…' : '🔄 Regenerar'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h2 style={{ fontSize: 17 }}>Propuesta comercial</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      Genera una propuesta en Markdown personalizada con ROI calculado para {lead.nombre}.
                    </p>
                    <button className="btn-gradient" onClick={generarProp} disabled={generandoPropuesta} style={{ alignSelf: 'flex-start' }}>
                      {generandoPropuesta ? 'Generando con Claude…' : '📄 Generar propuesta'}
                    </button>
                  </>
                )}
              </div>
            )}

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
                      <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 0' }}>{k}</td>
                        <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500 }}>{v}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600 }}>Total costes</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>{costes.total}€</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600 }}>MRR cliente</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-primary)' }}>{mrr}€</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 0', fontWeight: 700 }}>Margen</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: margen > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {margen}€ ({Math.round((margen / mrr) * 100)}%)
                      </td>
                    </tr>
                  </tbody>
                </table>
                {lead.mrr_estimado == null && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 14 }}>
                    ℹ️ Lead sin cualificar — cálculo con MRR por defecto de 190€.
                  </p>
                )}
              </div>
            )}

            {tab === 'notas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ fontSize: 17 }}>Notas</h2>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  onBlur={guardarNotas}
                  rows={12}
                  placeholder="Apuntes de llamadas, objeciones, próximos pasos…"
                  style={{ width: '100%' }}
                />
                {notasGuardadas && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Guardado a las {notasGuardadas}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
