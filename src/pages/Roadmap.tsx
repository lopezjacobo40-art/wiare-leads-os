import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Spinner, CaretDown, BookOpen, Signpost } from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { FASES_SEMILLA, type Fase, type EstadoFase } from '../lib/roadmapData'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'

/* Configuración visual por estado: color + icono + etiqueta. */
const ESTADO: Record<EstadoFase, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  completado:   { label: 'Completado',  color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)',  Icon: CheckCircle },
  en_progreso:  { label: 'En progreso', color: 'var(--color-primary)', bg: 'var(--color-primary-subtle)', Icon: Spinner },
  pendiente:    { label: 'Pendiente',   color: 'var(--color-text-tertiary)', bg: 'var(--color-surface-2)', Icon: Circle },
}

const ORDEN_CICLO: EstadoFase[] = ['pendiente', 'en_progreso', 'completado']

export default function Roadmap() {
  const toast = useToast()
  const esAdmin = (sessionStorage.getItem('wiare_user') ?? '') === 'jacobo'

  const [fases, setFases] = useState<Fase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [subTab, setSubTab] = useState<'roadmap' | 'onboarding'>('onboarding')

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
        subtitulo="Onboarding interactivo de la agencia y fases de escalado del negocio."
      />

      {/* Navegación por pestañas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
        <button
          onClick={() => setSubTab('onboarding')}
          className={`btn-ghost ${subTab === 'onboarding' ? 'active' : ''}`}
          style={{
            background: subTab === 'onboarding' ? 'var(--color-primary-subtle)' : 'transparent',
            color: subTab === 'onboarding' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 150ms ease',
          }}
        >
          <BookOpen size={16} weight={subTab === 'onboarding' ? 'fill' : 'regular'} /> Onboarding (Guía OS)
        </button>
        <button
          onClick={() => setSubTab('roadmap')}
          className={`btn-ghost ${subTab === 'roadmap' ? 'active' : ''}`}
          style={{
            background: subTab === 'roadmap' ? 'var(--color-primary-subtle)' : 'transparent',
            color: subTab === 'roadmap' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 150ms ease',
          }}
        >
          <Signpost size={16} weight={subTab === 'roadmap' ? 'fill' : 'regular'} /> Roadmap de la Agencia
        </button>
      </div>

      {/* ── TAB ONBOARDING ── */}
      {subTab === 'onboarding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={22} weight="fill" style={{ color: 'var(--color-primary)' }} />
              Guía de Onboarding de Leads OS
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Bienvenido al sistema operativo de WIARE. Esta plataforma centraliza todo tu pipeline comercial: desde la extracción de negocios en Google Maps hasta la entrega de la propuesta, la configuración técnica de la agente de voz inteligente (Sofía) y el checklist de QA. Sigue esta guía paso a paso con tu equipo para dominar el OS.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Sección 1 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>1. Extracción de Leads Fríos</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Ve a la pestaña <strong>"Extraer leads"</strong>. Escribe un sector (ej: <em>Clínica podológica</em> o <em>Taller mecánico</em>) y una ciudad (ej: <em>Valencia</em>). El sistema lanzará un robot en Apify para scrapear negocios reales de Google Maps de forma masiva en segundo plano.
                </p>
              </div>

              {/* Sección 2 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>2. Enriquecimiento y Búsqueda de Decisores en Lote</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Una vez extraídos, ve a <strong>"Todos los leads"</strong>. Selecciona en lote los leads que te interesen y haz clic en <strong>"Buscar decisores"</strong> en la barra inferior. El OS buscará de forma automatizada los nombres de los fundadores/dueños en LinkedIn, deducirá su correo electrónico directo e inyectará la información sin que tengas que ir uno por uno.
                </p>
              </div>

              {/* Sección 3 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>3. Calificación de Brechas e Informe IA</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Con tus leads seleccionados, haz clic en <strong>"Analizar brechas"</strong> en lote. Claude analizará sus datos públicos (reseñas, horario, web) y calculará cuántas llamadas pierden a la semana y cuántos euros les cuesta al mes. Además, te redactará de forma automática el correo frío estilo Alex Hormozi (saludo casual, icebreaker real, dolor económico y propuesta de valor directa).
                </p>
              </div>

              {/* Sección 4 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>4. Preparación de la "Demo Robada" (Paso Crítico)</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Entra en la ficha de detalle de cualquier lead caliente. Haz clic en <strong>"Paso 1: Generar Guión"</strong> para redactar el diálogo. Si necesitas corregir la pronunciación o palabras, modifícalo en el formulario interactivo. Luego, haz clic en <strong>"Paso 2: Generar Audio"</strong>. El sistema sintetizará un audio real simulado en español de España de alta naturalidad usando pausas y respiraciones de Azure/ElevenLabs.
                </p>
              </div>

              {/* Sección 5 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>5. Outreach Casual (Gmail y WhatsApp)</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Haz clic en <strong>"Abrir Gmail"</strong> en la vista detallada del lead. El OS abrirá tu cliente de correo con el asunto y cuerpo de Hormozi ya rellenados. Al enviar, haz clic en <strong>"Marcar como enviado"</strong> para avanzar la fase en el pipeline. Usa los botones rápidos de WhatsApp para pasarle el audio de 30 segundos directamente a su móvil.
                </p>
              </div>

              {/* Sección 6 */}
              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>6. Centralización del Cierre y Entrega (Business OS)</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Cuando el prospecto muestre interés:
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li><strong>Propuesta Comercial:</strong> Ve a la pestaña <em>"Propuesta"</em> del cliente. Haz clic en <em>"Generar propuesta con IA"</em>. Podrás ver la previsualización al instante, editarla en Markdown y enviarla al cliente.</li>
                    <li><strong>Agente de Voz:</strong> Cuando acepte, vincula su <em>Retell Agent ID</em> en la pestaña <em>"Agente Sofía"</em>. Puedes generar su prompt de comportamiento (identidad, FAQ del sector, reglas de reserva) en 1-clic usando la IA.</li>
                    <li><strong>Checklist de Entrega:</strong> Sigue los pasos técnicos (Twilio, Retell, QA, Setup, Formación) en la pestaña <em>"Checklist"</em> en tiempo real para no dejar ningún cabo suelto antes de marcar al cliente como <strong>Activo</strong>.</li>
                  </ul>
                </p>
              </div>
            </div>
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
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
            <div style={{ position: 'relative' }}>
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
    </PageTransition>
  )
}
