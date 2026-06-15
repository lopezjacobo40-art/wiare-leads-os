import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Microphone, FileText, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import ScoreBadge from '../components/ScoreBadge'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'

type TabBib = 'demos' | 'propuestas'

export default function Biblioteca() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabBib>('demos')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase
      .from('leads_os')
      .select('id,nombre,sector,ciudad,score_cualificacion,fase,agent_id_retell,propuesta_md,propuesta_slides,propuesta_tipo,created_at,telefono')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLeads((data ?? []) as Lead[])
        setLoading(false)
      })
  }, [])

  const demos = leads.filter((l) => !!l.agent_id_retell)
  const propuestas = leads.filter((l) => !!l.propuesta_md || !!l.propuesta_slides)

  const lista = tab === 'demos' ? demos : propuestas

  const filtrada = busqueda.trim()
    ? lista.filter((l) => l.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (l.sector ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    : lista

  const TABS: { id: TabBib; label: string; icon: typeof Microphone; count: number }[] = [
    { id: 'demos', label: 'Demos Retell', icon: Microphone, count: demos.length },
    { id: 'propuestas', label: 'Propuestas', icon: FileText, count: propuestas.length },
  ]

  return (
    <PageTransition>
      <PageHeader
        titulo="Biblioteca"
        subtitulo="Demos de voz y propuestas generadas para todos los leads"
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(({ id, label, icon: Icon, count }) => {
          const activo = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', fontSize: 14, fontWeight: 500,
                background: 'transparent', border: 'none',
                borderBottom: activo ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                marginBottom: -1, borderRadius: 0, minHeight: 'auto',
                transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Icon size={15} weight={activo ? 'fill' : 'regular'} />
              {label}
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                background: activo ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: activo ? '#fff' : 'var(--color-text-secondary)',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 320 }}>
          <MagnifyingGlass
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}
          />
          <input
            placeholder="Buscar por nombre o sector…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%', height: 34, paddingLeft: 30, paddingRight: 12,
              fontSize: 13, border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', outline: 'none',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <Skeleton.Row key={i} />)}</tbody>
          </table>
        </div>
      ) : filtrada.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>
            {tab === 'demos' ? '🎙' : '📄'}
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
            {busqueda ? 'Sin resultados' : tab === 'demos' ? 'Sin demos creadas' : 'Sin propuestas generadas'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {busqueda ? 'Prueba con otro término de búsqueda.' : tab === 'demos' ? 'Ve a un lead y genera la demo de voz con Sofía.' : 'Ve a un lead y genera la propuesta comercial.'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                {[
                  { label: 'Score' },
                  { label: 'Nombre' },
                  { label: 'Sector' },
                  { label: 'Fase' },
                  tab === 'demos' ? { label: 'Agent ID' } : { label: 'Formato' },
                  { label: '' },
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      padding: '0 16px', height: 36,
                      fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrada.map((lead) => (
                <tr
                  key={lead.id}
                  style={{ height: 52, borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                  onClick={() => navigate(`/leads/${lead.id}${tab === 'demos' ? '' : '#propuesta'}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0 16px' }}>
                    <ScoreBadge score={lead.score_cualificacion} size="sm" />
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{lead.nombre}</div>
                    {lead.ciudad && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{lead.ciudad}</div>
                    )}
                  </td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)' }}>{lead.sector}</td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {FASE_LABELS[lead.fase] ?? lead.fase}
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    {tab === 'demos' ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {lead.agent_id_retell?.slice(0, 20)}…
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 500,
                        background: lead.propuesta_slides ? 'rgba(99,102,241,0.08)' : 'rgba(34,197,94,0.08)',
                        color: lead.propuesta_slides ? 'var(--color-primary)' : 'var(--color-success)',
                      }}>
                        {lead.propuesta_slides && lead.propuesta_md ? 'Texto + Slides' : lead.propuesta_slides ? 'Slides' : 'Texto'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <button
                      className="btn-ghost"
                      style={{ padding: '6px 12px', minHeight: 32, fontSize: 12, gap: 6 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`) }}
                    >
                      Ver lead <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  )
}
