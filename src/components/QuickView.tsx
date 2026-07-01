import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ArrowRight, Phone, Globe, MapPin, Star, Clock,
  MagnifyingGlassPlus, PaperPlaneTilt, Copy, PlayCircle,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { analizarBrechas, toAnalisisBrechas, generarGuionAudio } from '../lib/claudeApi'
import ScoreBadge from './ScoreBadge'
import FaseSelector from './FaseSelector'
import { useToast } from './Toast'
import { fetchWithAudit } from '../lib/apiAuditor'



const PANEL_WIDTH = 480

/* Panel lateral derecho con la info clave de un lead.
   Acciones de generación → navegan al detalle completo en su pestaña
   (reutilizan el flujo real de LeadDetalle, sin duplicar su lógica).
   Cualificar con IA sí se ejecuta inline (acción atómica). */
export default function QuickView({
  lead,
  onClose,
  onUpdated,
}: {
  lead: Lead | null
  onClose: () => void
  onUpdated?: () => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [notas, setNotas] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [generandoAudio, setGenerandoAudio] = useState(false)
  const [localLead, setLocalLead] = useState<Lead | null>(lead)

  // Sincroniza el estado local cuando cambia el lead recibido.
  useEffect(() => {
    setLocalLead(lead)
    if (lead) setNotas(lead.notas ?? '')
  }, [lead])

  // Cerrar con Escape (escape-route, regla §1).
  useEffect(() => {
    if (!lead) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lead, onClose])

  if (!localLead) return null
  const l = localLead

  const irADetalle = () => navigate(`/leads/${l.id}`)

  const guardarNotas = async () => {
    if (notas === (l.notas ?? '')) return
    const { error } = await supabase.from('leads_os').update({ notas }).eq('id', l.id)
    if (error) toast(error.message, 'error')
    else {
      setLocalLead({ ...l, notas })
      onUpdated?.()
    }
  }

  const analizar = async () => {
    setAnalizando(true)
    try {
      const r = await analizarBrechas(l)
      const campos = {
        score_cualificacion: r.score,
        motivo_score: r.resumen,
        volumen_llamadas: r.volumen,
        mrr_estimado: r.mrr,
        analisis_brechas: toAnalisisBrechas(r),
        analizado_at: new Date().toISOString(),
        fase: l.fase === 'nuevo' ? 'negocio_analizado' : l.fase,
      }
      const { error } = await supabase.from('leads_os').update(campos).eq('id', l.id)
      if (error) throw error
      setLocalLead({ ...l, ...campos })
      onUpdated?.()
      toast(`${l.nombre} analizado`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al analizar', 'error')
    } finally {
      setAnalizando(false)
    }
  }

  const generarDemoAudio = async () => {
    const provider = localStorage.getItem('tts_provider') || import.meta.env.VITE_TTS_PROVIDER || 'elevenlabs'
    
    let apiKey = ''
    let voiceIdAi = ''
    let voiceIdCliente = ''
    let azureRegion = ''
    
    if (provider === 'azure') {
      apiKey = localStorage.getItem('azure_api_key') || import.meta.env.VITE_AZURE_API_KEY || ''
      azureRegion = localStorage.getItem('azure_region') || import.meta.env.VITE_AZURE_REGION || 'westeurope'
      voiceIdAi = localStorage.getItem('azure_voice_id') || import.meta.env.VITE_AZURE_VOICE_ID || 'es-ES-ElviraNeural'
      voiceIdCliente = localStorage.getItem('azure_voice_id_cliente') || import.meta.env.VITE_AZURE_VOICE_ID_CLIENTE || 'es-ES-AlvaroNeural'
      
      if (!apiKey) {
        toast('Configura tu clave de suscripción de Azure Speech en Configuración primero', 'error')
        return
      }
    } else {
      apiKey = localStorage.getItem('elevenlabs_api_key') || import.meta.env.VITE_ELEVENLABS_API_KEY || ''
      voiceIdAi = localStorage.getItem('elevenlabs_voice_id') || import.meta.env.VITE_ELEVENLABS_VOICE_ID || ''
      voiceIdCliente = localStorage.getItem('elevenlabs_voice_id_cliente') || import.meta.env.VITE_ELEVENLABS_VOICE_ID_CLIENTE || ''
      
      if (!apiKey || !voiceIdAi || !voiceIdCliente) {
        toast('Configura las TRES claves de ElevenLabs en Configuración o en el archivo .env primero (API Key, Voice AI, Voice Cliente)', 'error')
        return
      }
    }
    
    setGenerandoAudio(true)
    try {
      // 1. Obtener el guion de 2 voces de Claude
      const guion = await generarGuionAudio(l)
      
      const audioBlobs: Blob[] = []

      // Helper para escapar XML
      const escapeXml = (unsafe: string) => {
        return unsafe.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
          }
        });
      }

      // 2. Generar el audio línea por línea
      for (const linea of guion) {
        const voiceId = linea.speaker === 'cliente' ? voiceIdCliente : voiceIdAi
        
        let res: Response
        if (provider === 'azure') {
          const ssml = `<speak version='1.0' xml:lang='es-ES'><voice xml:lang='es-ES' name='${voiceId}'>${escapeXml(linea.text)}</voice></speak>`
          res = await fetchWithAudit(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
            method: 'POST',
            service: 'Generic',
            retries: 3,
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
              'User-Agent': 'wiare-leads-os'
            },
            body: ssml
          })
        } else {
          res = await fetchWithAudit(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            service: 'ElevenLabs',
            retries: 3,
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': apiKey
            },
            body: JSON.stringify({
              text: linea.text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
              }
            })
          })
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Error en el sintetizador (${provider} - ${linea.speaker}): ${errText}`)
        }
        
        const blob = await res.blob()
        audioBlobs.push(blob)
      }

      // 3. Concatenar los Blobs MP3
      const audioFinalBlob = new Blob(audioBlobs, { type: 'audio/mpeg' })
      
      // 4. Subir a Supabase Storage
      const fileName = `demo_${l.id}_${Date.now()}.mp3`
      const { error } = await supabase.storage.from('demos_audio').upload(fileName, audioFinalBlob, {
        contentType: 'audio/mpeg',
        upsert: false
      })

      if (error) throw error

      // 5. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage.from('demos_audio').getPublicUrl(fileName)

      // 4. Actualizar el lead en la BD
      const { error: dbError } = await supabase
        .from('leads_os')
        .update({ demo_audio_url: publicUrl })
        .eq('id', l.id)

      if (dbError) throw dbError

      setLocalLead({ ...l, demo_audio_url: publicUrl })
      onUpdated?.()
      toast('Demo de voz generada con éxito', 'success')
      
    } catch (err: any) {
      toast(err.message || 'Error al generar demo', 'error')
    } finally {
      setGenerandoAudio(false)
    }
  }

  const cambiarFase = async (fase: string) => {
    if (fase === l.fase) return
    const { error } = await supabase.from('leads_os').update({ fase }).eq('id', l.id)
    if (error) toast(error.message, 'error')
    else {
      setLocalLead({ ...l, fase })
      onUpdated?.()
      toast(`Fase: ${FASE_LABELS[fase] ?? fase}`, 'success')
    }
  }

  const programarSiguienteToque = async (tipo: 'Llamada' | 'WhatsApp' | 'Email' | null, diasAdelante: number) => {
    let proximo_toque_fecha = null
    if (diasAdelante > 0) {
      const d = new Date()
      d.setDate(d.getDate() + diasAdelante)
      proximo_toque_fecha = d.toISOString()
    }
    const { error } = await supabase.from('leads_os').update({ proximo_toque_fecha, proximo_toque_tipo: tipo }).eq('id', l.id)
    if (error) {
      toast('Error al programar toque', 'error')
    } else {
      setLocalLead({ ...l, proximo_toque_fecha, proximo_toque_tipo: tipo })
      onUpdated?.()
      toast(tipo ? `Programado: ${tipo} en ${diasAdelante} días` : 'Secuencia finalizada', 'success')
    }
  }

  const redactarGmail = () => {
    if (!l.email) {
      toast('Este lead no tiene email', 'error')
      return
    }

    let finalSubject = ''
    let finalBody = ''

    if (l.analisis_brechas?.email_asunto && l.analisis_brechas?.email_cuerpo) {
      finalSubject = l.analisis_brechas.email_asunto
      finalBody = l.analisis_brechas.email_cuerpo
    } else {
      const defaultSubject = 'pregunta rápida'
      const defaultBody = `{{icebreaker}}

{{puntos}}

Si te cuadra, ¿te paso un audio de 30 segundos por WhatsApp para que escuches cómo sonaría con el nombre de {{nombre_negocio}}? Si no encaja, cero compromiso.

Jacobo.`

      const subjectTemplate = localStorage.getItem('email_template_subject') || defaultSubject
      const bodyTemplate = localStorage.getItem('email_template_body') || defaultBody

      const nombreDecisor = l.decisor_nombre ? l.decisor_nombre.split(' ')[0] : 'propietario'
      const icebreaker = l.icebreaker || `Hola ${nombreDecisor}, vi vuestro negocio ${l.nombre} y me pareció muy interesante.`
      const puntosFormat = (l.analisis_brechas?.puntos_email || []).join('\n\n')

      finalSubject = subjectTemplate
        .replace(/{{nombre_negocio}}/g, l.nombre)
        .replace(/{{nombre_decisor}}/g, nombreDecisor)
        .replace(/{{ciudad}}/g, l.ciudad || 'tu ciudad')

      finalBody = bodyTemplate
        .replace(/{{nombre_negocio}}/g, l.nombre)
        .replace(/{{nombre_decisor}}/g, nombreDecisor)
        .replace(/{{ciudad}}/g, l.ciudad || 'tu ciudad')
        .replace(/{{icebreaker}}/g, icebreaker)
        .replace(/{{puntos}}/g, puntosFormat || '- Sin puntos detectados')
    }

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(l.email)}&su=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalBody)}`, '_blank')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.2)',
          zIndex: 199,
          animation: 'fade-in 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Vista rápida de ${l.nombre}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: PANEL_WIDTH,
          maxWidth: '100vw',
          background: '#fff',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          zIndex: 200,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          animation: 'quickview-in 250ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              onClick={onClose}
              aria-label="Cerrar vista rápida"
              className="btn-ghost"
              style={{ padding: 8, minHeight: 44, minWidth: 44 }}
            >
              <X size={18} />
            </button>
            <button
              onClick={irADetalle}
              className="btn-ghost"
              style={{ fontSize: 13, padding: '8px 12px', minHeight: 44 }}
            >
              Ver detalle completo <ArrowRight size={14} />
            </button>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>{l.nombre}</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {[l.ciudad, l.sector].filter(Boolean).join(' · ')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <ScoreBadge score={l.score_cualificacion} size="sm" />
            <span
              className="badge"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
            >
              {FASE_LABELS[l.fase] ?? l.fase}
            </span>
            {l.mrr_estimado != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                {l.mrr_estimado}€/mes
              </span>
            )}
          </div>
        </div>

        {/* Cuerpo (Todo en una vista, sin pestañas) */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* ── INFO BÁSICA ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
              {l.telefono && (
                <InfoFila icon={Phone} color="var(--color-success)" label="Teléfono">
                  <a href={`tel:${l.telefono.replace(/\s/g, '')}`}>{l.telefono}</a>
                </InfoFila>
              )}
              {l.web && (
                <InfoFila icon={Globe} color="var(--color-cyan)" label="Web">
                  <a href={l.web} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{l.web}</a>
                </InfoFila>
              )}
              {l.google_maps_url && (
                <InfoFila icon={MapPin} color="var(--color-error)" label="Ubicación">
                  <a href={l.google_maps_url} target="_blank" rel="noreferrer">Ver en Google Maps</a>
                </InfoFila>
              )}
              <InfoFila icon={Star} color="var(--color-warning)" label="Reputación">
                {l.valoracion ?? '—'} · {l.num_resenas ?? 0} reseñas
              </InfoFila>
              {l.horario && l.horario.length > 0 && (
                <InfoFila icon={Clock} color="var(--color-text-secondary)" label="Horario">
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {l.horario.map((h, i) => <div key={i}>{h}</div>)}
                  </div>
                </InfoFila>
              )}
              {l.descripcion && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingTop: 12, lineHeight: 1.5, marginBottom: 0 }}>
                  {l.descripcion}
                </p>
              )}

              {/* ── SECCIÓN DE ANÁLISIS DE IA ── */}
              {l.analizado_at ? (
                <div style={{ marginTop: 20, padding: 16, background: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', margin: 0 }}>Análisis de Brechas IA</h3>
                    {l.email && (
                      <button
                        onClick={redactarGmail}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12, minHeight: 'auto', gap: 6, display: 'inline-flex', alignItems: 'center' }}
                      >
                        <PaperPlaneTilt size={14} /> Enviar email
                      </button>
                    )}
                  </div>
                  
                  {l.analisis_brechas?.brechas && l.analisis_brechas.brechas.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Oportunidades de Mejora</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {l.analisis_brechas.brechas.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}

                  {l.motivo_score && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Motivo de Cualificación</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{l.motivo_score}</div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Redactado (Alex Hormozi)</div>
                    {l.analisis_brechas?.email_cuerpo ? (
                      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            <strong>Asunto:</strong> {l.analisis_brechas.email_asunto}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`Asunto: ${l.analisis_brechas!.email_asunto}\n\n${l.analisis_brechas!.email_cuerpo}`)
                              toast('Email copiado', 'info')
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-tertiary)' }}
                            title="Copiar email completo"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {l.analisis_brechas.email_cuerpo}
                        </div>
                      </div>
                    ) : l.analisis_brechas?.puntos_email && l.analisis_brechas.puntos_email.length > 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                        {l.analisis_brechas.puntos_email.join('\n\n')}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin email pregenerado</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={analizar}
                    className="btn-primary"
                    style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                    disabled={analizando}
                  >
                    {analizando ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <MagnifyingGlassPlus size={16} />}
                    {analizando ? 'Analizando con IA...' : 'Analizar Brechas con IA'}
                  </button>
                </div>
              )}

              {/* ── SECCIÓN DE DEMO DE VOZ ── */}
              <div style={{ marginTop: 20, padding: 16, background: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', margin: 0 }}>Demo Robada (Audio)</h3>
                  {!l.demo_audio_url && (
                    <button
                      onClick={generarDemoAudio}
                      className="btn-primary"
                      disabled={generandoAudio}
                      style={{ padding: '6px 12px', fontSize: 12, minHeight: 'auto', gap: 6, display: 'inline-flex', alignItems: 'center' }}
                    >
                      {generandoAudio ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <PlayCircle size={14} />}
                      Generar 30s
                    </button>
                  )}
                </div>
                
                {l.demo_audio_url ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <audio src={l.demo_audio_url} controls style={{ width: '100%', height: 36 }} />
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/d/${l.id}`
                        navigator.clipboard.writeText(url)
                        toast('Enlace copiado (wiare-leads.com/d/...)', 'info')
                      }}
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '4px 8px', alignSelf: 'flex-start', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Copy size={12} style={{ marginRight: 4 }} /> Copiar enlace para prospecto
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    No hay demo de voz generada todavía.
                  </div>
                )}
              </div>
              
              {/* ── SECCIÓN DE NURTURING (SECUENCIA) ── */}
              <div style={{ padding: 16, background: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', margin: 0 }}>Secuencia de Nurturing</h3>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Actual: <strong style={{ color: 'var(--color-text-primary)' }}>{l.proximo_toque_tipo || 'Ninguno'}</strong>
                  {l.proximo_toque_fecha && ` (Para: ${new Date(l.proximo_toque_fecha).toLocaleDateString()})`}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 11, minHeight: 32, padding: '4px 8px' }} onClick={() => programarSiguienteToque('Llamada', 3)}>
                    Email Hecho → Prog. Llamada (Día 3)
                  </button>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 11, minHeight: 32, padding: '4px 8px' }} onClick={() => programarSiguienteToque('WhatsApp', 2)}>
                    Llamada Hecha → Prog. WA (Día 5)
                  </button>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 11, minHeight: 32, padding: '4px 8px' }} onClick={() => programarSiguienteToque(null, 0)}>
                    Finalizar Secuencia
                  </button>
                </div>
              </div>
          </div>

          {/* ── NOTAS ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', margin: 0 }}>Notas Internas</h3>
              {notas !== (l.notas ?? '') && (
                <button
                  onClick={guardarNotas}
                  className="btn-primary"
                  style={{ fontSize: 11, padding: '4px 10px', minHeight: 28 }}
                >
                  Guardar notas
                </button>
              )}
            </div>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={guardarNotas}
              placeholder="Apuntes de llamadas, objeciones, próximos pasos…"
              style={{
                width: '100%',
                minHeight: 160,
                resize: 'vertical',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                fontSize: 14,
                lineHeight: 1.6,
                border: '1px solid var(--color-border)'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FaseSelector fase={l.fase} onChange={cambiarFase} />
          <button className="btn-secondary" onClick={irADetalle} style={{ marginLeft: 'auto' }}>
            Ver detalle completo
          </button>
        </div>
      </aside>
    </>
  )
}



function InfoFila({ icon: Icon, color, label, children }: { icon: any; color: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
      <Icon size={16} weight="fill" style={{ color, marginTop: 2, marginRight: 12 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{children}</div>
      </div>
    </div>
  )
}
