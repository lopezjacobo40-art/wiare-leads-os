import { useNavigate } from 'react-router-dom'
import { MapPin } from '@phosphor-icons/react'
import type { Lead } from '../lib/supabaseClient'
import { FASES, FASE_LABELS } from '../lib/supabaseClient'
import ScoreBadge from './ScoreBadge'

export default function KanbanBoard({ leads }: { leads: Lead[] }) {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
      {FASES.map((fase) => {
        const items = leads.filter((l) => l.fase === fase)
        return (
          <div key={fase} style={{ minWidth: 230, flex: '1 0 230px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {FASE_LABELS[fase]}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--bg-surface)',
                  borderRadius: 999,
                  padding: '2px 9px',
                  color: 'var(--text-secondary)',
                }}
              >
                {items.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((lead) => (
                <div
                  key={lead.id}
                  className="card"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  style={{ padding: 14, cursor: 'pointer' }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>
                    {lead.nombre}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <ScoreBadge score={lead.score_cualificacion} size="sm" />
                    {lead.mrr_estimado != null && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
                        {lead.mrr_estimado}€/mes
                      </span>
                    )}
                  </div>
                  {lead.ciudad && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} /> {lead.ciudad}
                    </p>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    border: '1px dashed var(--border)',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Vacío
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
