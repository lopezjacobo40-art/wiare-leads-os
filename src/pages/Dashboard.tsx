import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Fire, Microphone, CurrencyEur } from '@phosphor-icons/react'
import { supabase, type Lead, type Extraccion } from '../lib/supabaseClient'
import KanbanBoard from '../components/KanbanBoard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'

// Mini spark-line decorativa (5 barras, alturas placeholder que simulan tendencia semanal).
function Sparkline({ alturas }: { alturas: number[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
      {alturas.map((h, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: `${h}%`,
            borderRadius: 2,
            background: 'var(--color-primary)',
            opacity: 0.3,
          }}
        />
      ))}
    </div>
  )
}

// Patrones de tendencia (solo visual) por tarjeta.
const SPARK_PATTERNS: number[][] = [
  [40, 55, 45, 70, 90],
  [30, 50, 40, 65, 85],
  [50, 45, 60, 55, 80],
  [35, 60, 50, 75, 95],
]

export default function Dashboard() {
  const navigate = useNavigate()
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
    { label: 'Total leads', value: leads.length, icon: Users, color: 'var(--color-text-secondary)' },
    { label: 'Leads calientes', value: calientes, icon: Fire, color: 'var(--color-warning)' },
    { label: 'Demos creadas', value: demos, icon: Microphone, color: 'var(--color-primary)' },
    { label: 'MRR potencial', value: `${mrrTotal.toLocaleString('es-ES')}€`, icon: CurrencyEur, color: 'var(--color-success)' },
  ]

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><div className="spinner" /></div>
  }

  if (!error && leads.length === 0) {
    return (
      <PageTransition>
        <PageHeader titulo="Dashboard" subtitulo="Resumen del pipeline de leads" />
        <div className="card" style={{ padding: 0 }}>
          <EmptyState
            icon={Users}
            titulo="Aún no hay leads extraídos"
            descripcion="Extrae tus primeros negocios locales de Google Maps para empezar a construir el pipeline."
            accion={{ label: 'Extraer primeros leads →', onClick: () => navigate('/extraer') }}
          />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader titulo="Dashboard" subtitulo="Resumen del pipeline de leads" />
      {error && <p style={{ color: 'var(--color-error)', marginBottom: 16 }}>Error: {error}</p>}

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {metricas.map((m, i) => (
          <motion.div
            key={m.label}
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            style={{ padding: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: m.color,
                }}
              >
                <m.icon size={16} weight="bold" />
              </div>
              <Sparkline alturas={SPARK_PATTERNS[i] ?? SPARK_PATTERNS[0]} />
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
              {m.value}
            </p>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 4 }}>{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Pipeline */}
      <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: 16 }}>Pipeline de leads</h2>
      <KanbanBoard leads={leads} />

      {/* Paneles inferiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 32 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 18 }}>Leads por sector</h2>
          {sectores.length === 0 && <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Sin datos todavía</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sectores.map(([sector, count]) => (
              <div key={sector}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{sector}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-2)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: '100%',
                      background: 'var(--gradient-brand)',
                      borderRadius: 999,
                      transform: `scaleX(${count / maxSector})`,
                      transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
                      transformOrigin: 'left',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 18 }}>Últimas extracciones</h2>
          {extracciones.length === 0 && <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Sin extracciones todavía</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {extracciones.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{e.sector}</td>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>{e.ciudad}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>{e.total_leads} leads</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                    {new Date(e.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  )
}
