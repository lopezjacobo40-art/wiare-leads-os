import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MagnifyingGlass, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import ScoreBadge from '../components/ScoreBadge'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'

export default function Biblioteca() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase
      .from('leads_os')
      .select('id,nombre,sector,ciudad,score_cualificacion,fase,created_at,telefono,email,analisis_brechas,analizado_at')
      .not('analizado_at', 'is', null)
      .order('analizado_at', { ascending: false })
      .then(({ data }) => {
        setLeads((data ?? []) as Lead[])
        setLoading(false)
      })
  }, [])

  const filtrada = busqueda.trim()
    ? leads.filter((l) => l.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (l.sector ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    : leads

  return (
    <PageTransition>
      <PageHeader
        titulo="Negocios analizados"
        subtitulo="Negocios con informe de brechas hecho y 3 puntos listos para el email"
      />

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
          <MagnifyingGlassPlus size={32} weight="duotone" style={{ color: 'var(--color-text-tertiary)', marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
            {busqueda ? 'Sin resultados' : 'Aún no hay negocios analizados'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {busqueda ? 'Prueba con otro término de búsqueda.' : 'Ve a Leads y analiza las brechas de un negocio.'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  {['Score', 'Negocio', 'Sector', 'Ahorro estimado', 'Fase', 'Analizado', ''].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: '0 16px', height: 36,
                        fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrada.map((lead) => (
                  <tr
                    key={lead.id}
                    style={{ height: 52, borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    onClick={() => navigate(`/leads/${lead.id}`)}
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
                    <td style={{ padding: '0 16px', color: 'var(--color-success)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {lead.analisis_brechas?.ahorro_estimado ?? '—'}
                    </td>
                    <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {FASE_LABELS[lead.fase] ?? lead.fase}
                    </td>
                    <td style={{ padding: '0 16px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {lead.analizado_at ? new Date(lead.analizado_at).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td style={{ padding: '0 16px' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: '6px 12px', minHeight: 32, fontSize: 12, gap: 6 }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`) }}
                      >
                        Ver informe <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
