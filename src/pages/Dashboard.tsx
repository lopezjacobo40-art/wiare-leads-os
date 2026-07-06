import { useEffect, useState, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { Users, Fire, MagnifyingGlassPlus, CurrencyEur, ArrowRight, ArrowsClockwise } from '@phosphor-icons/react'
import { supabase, type Lead, type Extraccion } from '../lib/supabaseClient'
import { syncWebLeads } from '../lib/syncWebLeads'
import KanbanBoard from '../components/KanbanBoard'
import CockpitCierre from '../components/CockpitCierre'
import ColaDelDia from '../components/ColaDelDia'
import QuickView from '../components/QuickView'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import AuditorPanel from '../components/AuditorPanel'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'

const DIAS_7_MS = 7 * 24 * 60 * 60 * 1000
// Instante de carga del módulo: evita Date.now() durante el render
// (ventana de 7 días — la precisión al minuto es irrelevante)
const AHORA = Date.now()

export default function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [extracciones, setExtracciones] = useState<Extraccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickViewLead, setQuickViewLead] = useState<Lead | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [enviadosHoy, setEnviadosHoy] = useState(0)

  const cargar = async () => {
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads_os')
        .select('*')
        .neq('fase', 'descartado')
        .order('created_at', { ascending: false })
      if (leadsError) throw leadsError
      setLeads(leadsData as Lead[])
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Error cargando leads')
    } finally {
      setLoading(false)
    }
    // Extracciones es secundario — un error aquí no rompe el dashboard
    try {
      const { data: extData } = await supabase
        .from('extracciones_os')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      if (extData) setExtracciones(extData as Extraccion[])
    } catch {
      // Silencioso: puede fallar por permisos sin romper el resto
    }
    // Cupo diario de envíos (para la cola del día)
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('token_usage_os')
        .select('id', { count: 'exact', head: true })
        .eq('accion', 'email_enviado')
        .gte('created_at', hoy.toISOString())
      setEnviadosHoy(count ?? 0)
    } catch {
      // Silencioso: sin contador el cupo simplemente muestra 0
    }
  }

  useEffect(() => { cargar() }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!loading && containerRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.gsap-stagger',
          { opacity: 0, y: 40, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power4.out', stagger: 0.05 }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [loading])

  // ── Sincronización automática de leads de wiaresolution.com ──
  // Corre al montar y cada 5 min. Solo recarga el dashboard si trajo algo nuevo.
  useEffect(() => {
    const runSync = async () => {
      const resultado = await syncWebLeads()
      if (resultado.nuevos > 0) {
        toast(
          `${resultado.nuevos} lead${resultado.nuevos > 1 ? 's' : ''} nuevo${resultado.nuevos > 1 ? 's' : ''} desde wiaresolution.com`,
          'success'
        )
        cargar()
      }
      if (resultado.errores > 0) {
        console.warn('Error en sync de leads web')
      }
    }

    runSync()
    const interval = setInterval(runSync, 5 * 60 * 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualSync = async () => {
    setSyncing(true)
    const resultado = await syncWebLeads()
    setSyncing(false)
    if (resultado.nuevos > 0) {
      toast(`${resultado.nuevos} leads nuevos desde la web`, 'success')
      cargar()
    } else {
      toast('Pipeline sincronizado — sin leads nuevos', 'info')
    }
  }

  const calientes = leads.filter((l) => (l.score_cualificacion ?? 0) >= 7).length
  const analizados = leads.filter((l) => l.analizado_at != null).length
  const mrrTotal = leads.reduce((acc, l) => acc + (l.mrr_estimado ?? 0), 0)
  const sinAnalizar = leads.filter((l) => l.analizado_at == null).length
  const nuevosSemana = leads.filter((l) => AHORA - new Date(l.created_at).getTime() < DIAS_7_MS).length

  const calientesSinTrabajar = leads.filter(
    (l) => (l.score_cualificacion ?? 0) >= 7 && l.fase === 'nuevo'
  )

  const porSector = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.sector] = (acc[l.sector] ?? 0) + 1
    return acc
  }, {})
  const sectores = Object.entries(porSector).sort((a, b) => b[1] - a[1])
  const maxSector = sectores[0]?.[1] ?? 1

  const pctAnalizados = leads.length > 0 ? Math.round((analizados / leads.length) * 100) : 0

  const metricas = [
    {
      label: 'Total leads',
      value: leads.length,
      icon: Users,
      color: 'var(--color-text-secondary)',
      contexto: sinAnalizar > 0 ? `${sinAnalizar} sin analizar` : 'Pipeline limpio',
      ratio: null as number | null,
    },
    {
      label: 'Leads calientes',
      value: calientes,
      icon: Fire,
      color: 'var(--color-warning)',
      contexto: `${calientesSinTrabajar.length} sin contactar`,
      ratio: leads.length > 0 ? Math.round((calientes / leads.length) * 100) : 0,
    },
    {
      label: 'Negocios analizados',
      value: analizados,
      icon: MagnifyingGlassPlus,
      color: 'var(--color-primary)',
      contexto: `${pctAnalizados}% del total`,
      ratio: pctAnalizados,
    },
    {
      label: 'MRR potencial',
      value: `${mrrTotal.toLocaleString('es-ES')}€`,
      icon: CurrencyEur,
      color: 'var(--color-success)',
      contexto: `${nuevosSemana} nuevos esta semana`,
      ratio: null as number | null,
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
      <PageHeader
        titulo="Dashboard"
        subtitulo="Resumen del pipeline de leads"
        acciones={
          <button
            onClick={handleManualSync}
            className="btn-ghost"
            disabled={syncing}
            aria-label="Sincronizar leads de la web"
            style={{ fontSize: 13, padding: '6px 12px', minHeight: 36, gap: 6 }}
          >
            <ArrowsClockwise size={14} style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            {syncing ? 'Sincronizando…' : 'Sincronizar web'}
          </button>
        }
      />


      {error && <p style={{ color: 'var(--color-error)', marginBottom: 16 }}>Error: {error}</p>}

      {/* Cola del día — lo único que hay que mirar por la mañana */}
      <ColaDelDia leads={leads} enviadosHoy={enviadosHoy} />

      {/* ── Cockpit de cierre: respuestas/reuniones + toques de hoy + enviados sin seguimiento ── */}
      <div id="cockpit-cierre">
        <CockpitCierre leads={leads} onOpenLead={(l) => setQuickViewLead(l)} onRefresh={cargar} />
      </div>

      <div ref={containerRef}>
        {/* Métricas Bento Grid (Gapless / Dense) */}
        <div className="bento-grid" style={{ marginBottom: 40 }}>
          {metricas.map((m) => {
            return (
              <div
                key={m.label}
                className="gsap-stagger col-span-1"
                style={{
                  background: 'var(--color-card)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 160,
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'default',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02) translateY(-4px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1) translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 10 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: m.color,
                    }}
                  >
                    <m.icon size={24} weight="fill" />
                  </div>
                </div>

                <div style={{ zIndex: 10, marginTop: 'auto' }}>
                  <p
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: m.color,
                      lineHeight: 1,
                      marginTop: 24,
                      letterSpacing: '-0.02em',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {m.value}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginTop: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {m.label}
                  </p>
                  {/* Barra de progreso contextual */}
                  {m.ratio != null && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{m.contexto}</span>
                        <span style={{ fontSize: 10, color: m.color, fontWeight: 700 }}>{m.ratio}%</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${m.ratio}%`,
                          background: m.color,
                          borderRadius: 999,
                          transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
                          opacity: 0.8
                        }} />
                      </div>
                    </div>
                  )}
                  {m.ratio == null && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>{m.contexto}</p>
                  )}
                </div>


              </div>
            )
          })}
        </div>
      </div>

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
                      transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
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
                  <td style={{ padding: '10px 0 10px 12px', textAlign: 'right' }}>
                    {e.extraccion_id ? (
                      <button
                        className="btn-ghost"
                        onClick={() => navigate(`/leads?extraccion=${e.extraccion_id}`)}
                        style={{ fontSize: 12, padding: '3px 10px', minHeight: 26, gap: 4 }}
                      >
                        Ver leads <ArrowRight size={12} />
                      </button>
                    ) : (
                      <button
                        className="btn-ghost"
                        onClick={() => navigate('/leads')}
                        style={{ fontSize: 12, padding: '3px 10px', minHeight: 26, gap: 4, color: 'var(--color-text-tertiary)' }}
                      >
                        Ver leads <ArrowRight size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AuditorPanel />

      {/* Vista rápida desde el Kanban */}
      <QuickView lead={quickViewLead} onClose={() => setQuickViewLead(null)} onUpdated={cargar} />
    </PageTransition>
  )
}
