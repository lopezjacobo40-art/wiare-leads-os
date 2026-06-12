import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Fire, Microphone, CurrencyEur } from '@phosphor-icons/react'
import { supabase, type Lead, type Extraccion } from '../lib/supabaseClient'
import KanbanBoard from '../components/KanbanBoard'

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [extracciones, setExtracciones] = useState<Extraccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('leads_os').select('*').order('created_at', { ascending: false }),
      supabase.from('extracciones_os').select('*').order('created_at', { ascending: false }).limit(5),
    ])
      .then(([l, e]) => {
        if (l.error) throw l.error
        if (e.error) throw e.error
        setLeads(l.data as Lead[])
        setExtracciones(e.data as Extraccion[])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const calientes = leads.filter((l) => (l.score_cualificacion ?? 0) >= 7).length
  const demos = leads.filter((l) => l.agent_id_retell).length
  const mrrTotal = leads.reduce((acc, l) => acc + (l.mrr_estimado ?? 0), 0)

  const porSector = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.sector] = (acc[l.sector] ?? 0) + 1
    return acc
  }, {})
  const sectores = Object.entries(porSector).sort((a, b) => b[1] - a[1])
  const maxSector = sectores[0]?.[1] ?? 1

  const metricas = [
    { label: 'Total leads', value: leads.length, icon: Users, color: 'var(--accent-primary)' },
    { label: 'Leads calientes', value: calientes, icon: Fire, color: 'var(--orange)' },
    { label: 'Demos creadas', value: demos, icon: Microphone, color: 'var(--accent-cyan)' },
    { label: 'MRR potencial', value: `${mrrTotal.toLocaleString('es-ES')}€`, icon: CurrencyEur, color: 'var(--green)' },
  ]

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Dashboard</h1>
      {error && <p style={{ color: 'var(--red)', marginBottom: 16 }}>Error: {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {metricas.map((m, i) => (
          <motion.div
            key={m.label}
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: m.color,
                flexShrink: 0,
              }}
            >
              <m.icon size={24} weight="duotone" />
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{m.value}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Pipeline</h2>
      <KanbanBoard leads={leads} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 32 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 18 }}>Leads por sector</h2>
          {sectores.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sin datos todavía</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sectores.map(([sector, count]) => (
              <div key={sector}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{sector}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-surface)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(count / maxSector) * 100}%`,
                      background: 'var(--gradient-main)',
                      borderRadius: 999,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 18 }}>Últimas extracciones</h2>
          {extracciones.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sin extracciones todavía</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {extracciones.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{e.sector}</td>
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{e.ciudad}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>{e.total_leads} leads</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {new Date(e.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
