import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Fire, Microphone, CurrencyEur, Clock, CheckCircle, ArrowRight, CaretRight } from '@phosphor-icons/react'
import { supabase, type Lead, type Extraccion } from '../lib/supabaseClient'
import KanbanBoard from '../components/KanbanBoard'
import QuickView from '../components/QuickView'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'

const DIAS_7_MS = 7 * 24 * 60 * 60 * 1000

export default function Dashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [extracciones, setExtracciones] = useState<Extraccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickViewLead, setQuickViewLead] = useState<Lead | null>(null)

  const cargar = () =>
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

  useEffect(() => { cargar() }, [])

  const calientes = leads.filter((l) => (l.score_cualificacion ?? 0) >= 7).length
  const demos = leads.filter((l) => l.agent_id_retell).length
  const mrrTotal = leads.reduce((acc, l) => acc + (l.mrr_estimado ?? 0), 0)
  const sinScore = leads.filter((l) => l.score_cualificacion == null).length
  const nuevosSemana = leads.filter((l) => Date.now() - new Date(l.created_at).getTime() < DIAS_7_MS).length

  // ── Alertas de "tu lista de hoy" ──
  const calientesSinTrabajar = leads.filter(
    (l) => (l.score_cualificacion ?? 0) >= 7 && l.fase === 'nuevo'
  )
  const demoSinPropuesta = leads.filter(
    (l) => l.fase === 'demo_creada' && !l.propuesta_md
  )
  const sinActividad = leads.filter(
    (l) => l.fase === 'nuevo' && Date.now() - new Date(l.created_at).getTime() > DIAS_7_MS
  )
  const totalAlertas = calientesSinTrabajar.length + demoSinPropuesta.length + sinActividad.length

  const porSector = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.sector] = (acc[l.sector] ?? 0) + 1
    return acc
  }, {})
  const sectores = Object.entries(porSector).sort((a, b) => b[1] - a[1])
  const maxSector = sectores[0]?.[1] ?? 1

  const metricas = [
    {
      label: 'Total leads',
      value: leads.length,
      icon: Users,
      color: 'var(--color-text-secondary)',
      contexto: sinScore > 0 ? `${sinScore} sin score` : 'Todos cualificados',
    },
    {
      label: 'Leads calientes',
      value: calientes,
      icon: Fire,
      color: 'var(--color-warning)',
      contexto: `${calientesSinTrabajar.length} sin contactar`,
    },
    {
      label: 'Demos creadas',
      value: demos,
      icon: Microphone,
      color: 'var(--color-primary)',
      contexto: `${demos} activas`,
    },
    {
      label: 'MRR potencial',
      value: `${mrrTotal.toLocaleString('es-ES')}€`,
      icon: CurrencyEur,
      color: 'var(--color-success)',
      contexto: `${nuevosSemana} esta semana`,
    },
  ]

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Dashboard" subtitulo="Resumen del pipeline de leads" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
        <Skeleton.Line width={160} height={16} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton.Rect key={i} width={220} height={200} radius={14} />)}
        </div>
      </PageTransition>
    )
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {metricas.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            whileHover={{ y: -2 }}
            style={{
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
              transition: 'box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)')}
          >
            {/* Fila superior: icono container */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: m.color,
                }}
              >
                <m.icon size={20} weight="bold" />
              </div>
            </div>

            {/* Número principal */}
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                lineHeight: 1.05,
                marginTop: 16,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {m.value}
            </p>

            {/* Label */}
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginTop: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {m.label}
            </p>

            {/* Línea inferior: separador + contexto */}
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 16, paddingTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>{m.contexto}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tu lista de hoy — alertas */}
      <AlertasHoy
        total={totalAlertas}
        calientes={calientesSinTrabajar.length}
        demoSinPropuesta={demoSinPropuesta.length}
        sinActividad={sinActividad.length}
        navigate={navigate}
      />

      {/* Pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Pipeline de leads</h2>
        <button
          className="btn-ghost"
          onClick={() => navigate('/leads')}
          style={{ fontSize: 13, padding: '6px 12px', minHeight: 36 }}
        >
          Ver todos <ArrowRight size={14} />
        </button>
      </div>
      <KanbanBoard leads={leads} onOpenLead={(lead) => setQuickViewLead(lead)} />

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
                  <span style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
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
                  <td style={{ padding: '10px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{e.total_leads} leads</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                    {new Date(e.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista rápida desde el Kanban */}
      <QuickView lead={quickViewLead} onClose={() => setQuickViewLead(null)} onUpdated={cargar} />
    </PageTransition>
  )
}

// ── Card de alertas "Tu lista de hoy" ──
function AlertasHoy({
  total,
  calientes,
  demoSinPropuesta,
  sinActividad,
  navigate,
}: {
  total: number
  calientes: number
  demoSinPropuesta: number
  sinActividad: number
  navigate: (to: string) => void
}) {
  const filas = [
    calientes > 0 && {
      key: 'calientes',
      icon: Fire,
      color: 'var(--color-warning)',
      bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
      texto: `${calientes} ${calientes === 1 ? 'lead caliente sin contactar' : 'leads calientes sin contactar'}`,
      to: '/leads?score_min=7&fase=nuevo',
    },
    demoSinPropuesta > 0 && {
      key: 'demo',
      icon: Microphone,
      color: 'var(--color-primary)',
      bg: 'var(--color-primary-subtle)',
      texto: `${demoSinPropuesta} con demo pero sin propuesta`,
      to: '/leads?fase=demo_creada&sin_propuesta=1',
    },
    sinActividad > 0 && {
      key: 'inactivos',
      icon: Clock,
      color: 'var(--color-error)',
      bg: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
      texto: `${sinActividad} ${sinActividad === 1 ? 'lead sin actividad en 7+ días' : 'leads sin actividad en 7+ días'}`,
      to: '/leads?fase=nuevo&inactivo=7',
    },
  ].filter(Boolean) as {
    key: string
    icon: typeof Fire
    color: string
    bg: string
    texto: string
    to: string
  }[]

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: filas.length ? 14 : 0 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Tu lista de hoy</h2>
        {total > 0 && (
          <span
            className="badge"
            style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </span>
        )}
      </div>

      {filas.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-success)' }}>
          <CheckCircle size={20} weight="fill" />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Todo al día · Sin pendientes</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filas.map((f) => (
            <button
              key={f.key}
              onClick={() => navigate(f.to)}
              aria-label={f.texto}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                minHeight: 44,
                textAlign: 'left',
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: f.bg,
                  color: f.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <f.icon size={16} weight="bold" />
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{f.texto}</span>
              <CaretRight size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
