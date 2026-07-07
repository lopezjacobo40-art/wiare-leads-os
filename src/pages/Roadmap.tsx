import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Spinner, CaretDown, BookOpen, Signpost, Headset } from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { FASES_SEMILLA, type Fase, type EstadoFase } from '../lib/roadmapData'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'
import Simulador from './Simulador'

/* Configuración visual por estado: color + icono + etiqueta. */
const ESTADO: Record<EstadoFase, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  completado:   { label: 'Completado',  color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)',  Icon: CheckCircle },
  en_progreso:  { label: 'En progreso', color: 'var(--color-primary)', bg: 'var(--color-primary-subtle)', Icon: Spinner },
  pendiente:    { label: 'Pendiente',   color: 'var(--color-text-tertiary)', bg: 'var(--color-surface-2)', Icon: Circle },
}

const ORDEN_CICLO: EstadoFase[] = ['pendiente', 'en_progreso', 'completado']

type SubTab = 'roadmap' | 'onboarding' | 'simulador'

const TABS: { id: SubTab; label: string; Icon: typeof BookOpen }[] = [
  { id: 'onboarding', label: 'Onboarding', Icon: BookOpen },
  { id: 'roadmap', label: 'Roadmap', Icon: Signpost },
  { id: 'simulador', label: 'Simulador', Icon: Headset },
]

/* ── Guía de onboarding: el flujo real del OS, paso a paso ── */
const PASOS_GUIA: { titulo: string; cuerpo: React.ReactNode }[] = [
  {
    titulo: 'Dashboard — empieza el día en «Hoy»',
    cuerpo: (
      <>El bloque <strong>Hoy</strong> te dice exactamente qué toca: cuántos leads analizar, cuántos emails
      enviar (cupo de 15/día por deliverability), qué follow-ups vencen y qué respuestas esperan.
      Debajo, el <strong>Cockpit de cierre</strong> agrupa respuestas, toques del día y enviados sin seguimiento.</>
    ),
  },
  {
    titulo: 'Extraer leads fríos',
    cuerpo: (
      <>En <strong>Extraer leads</strong>, escribe sector y ciudad (p. ej. «clínica dental» en «Valencia»).
      Apify scrapea negocios reales de Google Maps en segundo plano y los deduplica contra tu pipeline.</>
    ),
  },
  {
    titulo: 'Enriquecer: email real y decisor',
    cuerpo: (
      <>En <strong>Todos los leads</strong>, selecciona en lote y pulsa <strong>Buscar decisores</strong>:
      el OS localiza al dueño en LinkedIn y busca su email real con una cascada de 5 scrapers
      (nunca inventa un patrón info@).</>
    ),
  },
  {
    titulo: 'Analizar brechas con IA',
    cuerpo: (
      <>Selecciona leads y pulsa <strong>Analizar brechas</strong>: Claude estima llamadas perdidas,
      coste mensual y redacta el email frío estilo Hormozi con los puntos de dolor detectados.
      El lead avanza a <strong>Negocio analizado</strong>.</>
    ),
  },
  {
    titulo: 'La demo de audio (el momento wow)',
    cuerpo: (
      <>Desde la ficha del lead: <strong>Generar guión</strong> (diálogo cliente-Sofía personalizado),
      corrige lo que quieras y <strong>Generar audio</strong>. Obtienes un enlace público
      (/d/:id) con telemetría: sabrás cuándo lo escuchan.</>
    ),
  },
  {
    titulo: 'Outreach con secuencia automática',
    cuerpo: (
      <><strong>Abrir Gmail</strong> prerrellena asunto y cuerpo. Al marcar <strong>enviado</strong>, el OS
      guarda el copy exacto, arranca la secuencia (D0 email → D3 email → D7 WhatsApp → D14 breakup)
      y programa cada toque solo. Si no responde tras la secuencia, se archiva en «Sin respuesta».</>
    ),
  },
  {
    titulo: 'Contenido: presencia de marca sin esfuerzo',
    cuerpo: (
      <>La sección <strong>Contenido</strong> concentra el Instagram Manager (backlog → borrador →
      programado → publicado), el calendario con «Planificar mes», las secuencias de Historias por
      objetivo, los competidores con consejo IA de qué replicar, y las noticias del sector
      convertibles en ideas con un click. Todo usa tu Brand Kit y tu voz de marca.</>
    ),
  },
  {
    titulo: 'Cierre y entrega',
    cuerpo: (
      <>Cuando el prospecto muestra interés: genera la <strong>propuesta comercial</strong> con IA desde su
      ficha, vincula su <strong>Retell Agent ID</strong> en la pestaña Agente Sofía (prompt generado en
      1 click) y sigue el <strong>checklist de entrega</strong> (Twilio, Retell, QA, formación) antes de
      marcarlo Activo.</>
    ),
  },
  {
    titulo: 'Entrena tu pitch',
    cuerpo: (
      <>El <strong>Simulador</strong> (pestaña de arriba) te enfrenta a un cliente IA que se resiste, por
      sector y nivel de dureza, y evalúa la llamada al terminar. Úsalo antes de las llamadas reales.</>
    ),
  },
]

export default function Roadmap() {
  const toast = useToast()
  const esAdmin = (sessionStorage.getItem('wiare_user') ?? '') === 'jacobo'

  const [fases, setFases] = useState<Fase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SubTab) || 'onboarding'
  const [subTab, setSubTab] = useState<SubTab>(initialTab)

  // Sincronizar el query param al cambiar de tab para deep links
  useEffect(() => {
    if (subTab !== 'onboarding') {
      setSearchParams({ tab: subTab }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [subTab, setSearchParams])

  // Carga + seed automático si la tabla está vacía.
  useEffect(() => {
    const cargar = async () => {
      const { data, error } = await supabase
        .from('roadmap_os')
        .select('*')
        .order('orden', { ascending: true })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        // Primera vez: sembramos las 10 fases por defecto.
        const { data: insertadas, error: errSeed } = await supabase
          .from('roadmap_os')
          .insert(FASES_SEMILLA)
          .select()
          .order('orden', { ascending: true })
        if (errSeed) {
          setError(errSeed.message)
        } else {
          setFases((insertadas as Fase[]) ?? [])
        }
      } else {
        setFases(data as Fase[])
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const progreso = useMemo(() => {
    const total = fases.length || 1
    const completadas = fases.filter((f) => f.estado === 'completado').length
    const enProgreso = fases.filter((f) => f.estado === 'en_progreso').length
    return {
      completadas,
      enProgreso,
      total: fases.length,
      pct: Math.round((completadas / total) * 100),
    }
  }, [fases])

  const cambiarEstado = async (fase: Fase, nuevo: EstadoFase) => {
    setEditando(null)
    if (nuevo === fase.estado) return
    const previo = fase.estado
    // Optimista
    setFases((prev) => prev.map((f) => (f.id === fase.id ? { ...f, estado: nuevo } : f)))
    const { error } = await supabase
      .from('roadmap_os')
      .update({ estado: nuevo, updated_at: new Date().toISOString() })
      .eq('id', fase.id)
    if (error) {
      // Revertir
      setFases((prev) => prev.map((f) => (f.id === fase.id ? { ...f, estado: previo } : f)))
      toast('No se pudo guardar el cambio', 'error')
    } else {
      toast(`Fase marcada como ${ESTADO[nuevo].label.toLowerCase()}`, 'success')
    }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Manual y Roadmap WIARE"
        subtitulo="Cómo se trabaja en el OS y en qué fase de escalado está la agencia"
      />

      {/* Navegación por pestañas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map(({ id, label, Icon }) => {
          const activo = subTab === id
          return (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              aria-pressed={activo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 13,
                fontWeight: activo ? 600 : 500,
                border: 'none',
                minHeight: 'auto',
                background: activo ? 'var(--color-primary-subtle)' : 'transparent',
                color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Icon size={15} weight={activo ? 'fill' : 'regular'} /> {label}
            </button>
          )
        })}
      </div>

      {/* ── TAB ONBOARDING ── */}
      {subTab === 'onboarding' && (
        <div style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            WIARE Leads OS centraliza el pipeline completo: de la extracción en Google Maps al cliente
            activo, pasando por el análisis con IA, el outreach con secuencia automática y el contenido
            de marca. Este es el flujo de trabajo, en orden.
          </p>

          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {PASOS_GUIA.map((paso, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '18px 20px',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: 4, lineHeight: 1.35 }}>
                    {paso.titulo}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    {paso.cuerpo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB ROADMAP ── */}
      {subTab === 'roadmap' && (
        <>
          {/* Barra de progreso global */}
          {!loading && !error && fases.length > 0 && (
            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
                  {progreso.completadas}/{progreso.total} fases completadas
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {progreso.enProgreso} en progreso · <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-primary)' }}>{progreso.pct}%</span>
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progreso.pct}%` }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--gradient-brand)' }}
                />
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card" style={{ padding: 'var(--space-6)', display: 'flex', gap: 16 }}>
                  <Skeleton.Circle size={28} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton.Line width="45%" height={16} />
                    <Skeleton.Line width="85%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: 'var(--space-6)', color: 'var(--color-error)' }}>
              No se pudo cargar el roadmap: {error}
            </div>
          )}

          {/* Timeline vertical */}
          {!loading && !error && (
            <div style={{ position: 'relative', maxWidth: 760 }}>
              {fases.map((fase, i) => {
                const cfg = ESTADO[fase.estado]
                const { Icon } = cfg
                const esUltima = i === fases.length - 1
                const enProgreso = fase.estado === 'en_progreso'
                return (
                  <motion.div
                    key={fase.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(i * 0.04, 0.4) }}
                    style={{ display: 'flex', gap: 16, position: 'relative' }}
                  >
                    {/* Columna del nodo + línea conectora */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: cfg.bg,
                          color: cfg.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1.5px solid ${cfg.color}`,
                          zIndex: 1,
                        }}
                      >
                        <Icon
                          size={18}
                          weight={fase.estado === 'pendiente' ? 'regular' : 'fill'}
                          className={enProgreso ? 'roadmap-spin' : undefined}
                        />
                      </span>
                      {!esUltima && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 2,
                            flex: 1,
                            minHeight: 24,
                            background: 'var(--color-border-strong)',
                            marginTop: 2,
                            marginBottom: 2,
                          }}
                        />
                      )}
                    </div>

                    {/* Card de la fase */}
                    <div
                      className="card"
                      style={{
                        flex: 1,
                        padding: 'var(--space-5) var(--space-6)',
                        marginBottom: 'var(--space-4)',
                        borderColor: enProgreso ? 'var(--color-primary)' : 'var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
                          <span style={{ color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>
                            {String(fase.orden).padStart(2, '0')}
                          </span>
                          {fase.titulo}
                        </h3>

                        {/* Badge de estado / editor */}
                        {esAdmin ? (
                          <div style={{ position: 'relative' }}>
                            <button
                              className="badge"
                              onClick={() => setEditando(editando === fase.id ? null : fase.id)}
                              style={{
                                background: cfg.bg,
                                color: cfg.color,
                                border: `1px solid ${cfg.color}`,
                                cursor: 'pointer',
                                minHeight: 28,
                                padding: '4px 10px',
                              }}
                              aria-haspopup="listbox"
                              aria-expanded={editando === fase.id}
                            >
                              {cfg.label}
                              <CaretDown size={11} weight="bold" />
                            </button>
                            {editando === fase.id && (
                              <>
                                <div
                                  onClick={() => setEditando(null)}
                                  style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                                  aria-hidden="true"
                                />
                                <div
                                  role="listbox"
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    right: 0,
                                    zIndex: 21,
                                    background: '#fff',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: 'var(--shadow-md)',
                                    padding: 4,
                                    minWidth: 160,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                  }}
                                >
                                  {ORDEN_CICLO.map((est) => {
                                    const c = ESTADO[est]
                                    const activo = est === fase.estado
                                    return (
                                      <button
                                        key={est}
                                        role="option"
                                        aria-selected={activo}
                                        onClick={() => cambiarEstado(fase, est)}
                                        className="btn-ghost"
                                        style={{
                                          justifyContent: 'flex-start',
                                          gap: 8,
                                          width: '100%',
                                          minHeight: 36,
                                          fontSize: 13,
                                          background: activo ? 'var(--color-surface-2)' : 'transparent',
                                        }}
                                      >
                                        <c.Icon size={15} weight="fill" style={{ color: c.color, flexShrink: 0 }} />
                                        {c.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                        {fase.descripcion}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB SIMULADOR ── */}
      {subTab === 'simulador' && (
        <Simulador embedded={true} />
      )}
    </PageTransition>
  )
}
