import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ArrowRight, Phone, Globe, MapPin, Star, Clock,
  MagnifyingGlassPlus, CurrencyEur,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { analizarBrechas, toAnalisisBrechas } from '../lib/claudeApi'
import ScoreBadge from './ScoreBadge'
import FaseSelector from './FaseSelector'
import { useToast } from './Toast'

type Tab = 'info' | 'acciones' | 'notas'

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
  const [tab, setTab] = useState<Tab>('info')
  const [notas, setNotas] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [localLead, setLocalLead] = useState<Lead | null>(lead)

  // Sincroniza el estado local cuando cambia el lead recibido.
  useEffect(() => {
    setLocalLead(lead)
    setTab('info')
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

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Secciones de la vista rápida"
          style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--color-border)' }}
        >
          {([
            { id: 'info', label: 'Info' },
            { id: 'acciones', label: 'Acciones' },
            { id: 'notas', label: 'Notas' },
          ] as { id: Tab; label: string }[]).map((t) => {
            const activo = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={activo}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 10px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activo ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  marginBottom: -1,
                  borderRadius: 0,
                  minHeight: 44,
                  transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, padding: '20px 24px' }}>
          {/* ── TAB INFO ── */}
          {tab === 'info' && (
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
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingTop: 12, lineHeight: 1.5 }}>
                  {l.descripcion}
                </p>
              )}
            </div>
          )}

          {/* ── TAB ACCIONES ── */}
          {tab === 'acciones' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={analizar}
                disabled={analizando || l.analizado_at != null}
                style={accionBtnStyle}
                onMouseEnter={(e) => { if (analizando || l.analizado_at) return; e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = '#fff' }}
              >
                {analizando
                  ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  : <MagnifyingGlassPlus size={22} weight="regular" style={{ color: 'var(--color-primary)' }} />}
                <span>{analizando ? 'Analizando…' : l.analizado_at ? 'Ya analizado' : 'Analizar brechas'}</span>
              </button>
              <button
                onClick={() => navigate(`/leads/${l.id}`)}
                style={accionBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = '#fff' }}
              >
                <CurrencyEur size={22} weight="regular" style={{ color: 'var(--color-primary)' }} />
                <span>Ver informe y costes</span>
              </button>
            </div>
          )}

          {/* ── TAB NOTAS ── */}
          {tab === 'notas' && (
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={guardarNotas}
              placeholder="Apuntes de llamadas, objeciones, próximos pasos…"
              style={{
                width: '100%',
                minHeight: 240,
                resize: 'vertical',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            />
          )}
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

const accionBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 16,
  minHeight: 88,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  textAlign: 'center',
  transition: 'border-color 150ms cubic-bezier(0.4,0,0.2,1), background 150ms cubic-bezier(0.4,0,0.2,1)',
}

function InfoFila({
  icon: Icon,
  color,
  label,
  children,
}: {
  icon: typeof Phone
  color: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
      <Icon size={14} weight="fill" style={{ color, flexShrink: 0, marginTop: 3 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
