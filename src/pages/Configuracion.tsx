import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lightning,
  ArrowSquareOut,
  Warning,
  CheckCircle,
  XCircle,
  Database,
  Brain,
  Phone,
  MapPin,
  Table,
  FloppyDisk,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import Skeleton from '../components/Skeleton'

/* ─────────────────────────────────────────────
   Precios y supuestos de estimación de coste
   (no tocan tokenGuard.ts — son solo para mostrar coste estimado aquí)
   ───────────────────────────────────────────── */
const PRECIOS = {
  score: 0.0008, // €/1K tokens — Haiku 4.5
  content: 0.003, // €/1K tokens — Sonnet 4.6
  tokens_score: 400, // tokens medios por scoring
  tokens_content: 1800, // tokens medios por contenido
}

// Coste estimado por una acción (€) = (tokens / 1000) × precio/1K
const COSTE_SCORE = (PRECIOS.tokens_score / 1000) * PRECIOS.score // 0.00032 €
const COSTE_CONTENT = (PRECIOS.tokens_content / 1000) * PRECIOS.content // 0.0054 €

// Límites diarios (de .env, con defaults idénticos a tokenGuard.ts)
function limiteDe(tipo: 'score' | 'content'): number {
  const raw =
    tipo === 'score'
      ? import.meta.env.VITE_DAILY_SCORE_LIMIT
      : import.meta.env.VITE_DAILY_CONTENT_LIMIT
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : tipo === 'score' ? 100 : 20
}

const LIMITE_SCORE = limiteDe('score')
const LIMITE_CONTENT = limiteDe('content')

interface Registro {
  usuario: string
  accion: 'score' | 'content'
  created_at: string
  fecha: string
}

function fmtEur(n: number): string {
  return `${n.toFixed(2)}€`
}

function fmtEur4(n: number): string {
  // Para costes muy pequeños mostramos más decimales
  return n < 0.01 ? `${n.toFixed(4)}€` : `${n.toFixed(2)}€`
}

function isoDia(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Configuracion() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase
      .from('token_usage_os')
      .select('usuario, accion, created_at, fecha')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(true)
          setRegistros([])
          return
        }
        setRegistros((data as Registro[]) ?? [])
      })
  }, [])

  const cargando = registros === null
  const sinDatos = !cargando && registros.length === 0

  // ── Métricas derivadas ──
  const m = useMemo(() => {
    if (!registros || registros.length === 0) return null
    const hoyStr = isoDia(new Date())
    const mesActual = new Date().getMonth()
    const anioActual = new Date().getFullYear()

    let scoreHoy = 0
    let contentHoy = 0
    let scoreMes = 0
    let contentMes = 0
    let scoreTotal = 0
    let contentTotal = 0

    // Por usuario (mes en curso)
    const porUsuario: Record<string, { score: number; content: number }> = {}
    // Por día (clave ISO → conteo)
    const porDia: Record<string, { score: number; content: number }> = {}
    // Última actividad por usuario (ISO)
    const ultimaActividad: Record<string, string> = {}

    let primeraFecha = hoyStr

    for (const r of registros) {
      const fecha = new Date(r.created_at)
      const esScore = r.accion === 'score'

      if (esScore) scoreTotal++
      else contentTotal++

      if (r.fecha === hoyStr) {
        if (esScore) scoreHoy++
        else contentHoy++
      }

      if (fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual) {
        if (esScore) scoreMes++
        else contentMes++
        const u = r.usuario || 'desconocido'
        if (!porUsuario[u]) porUsuario[u] = { score: 0, content: 0 }
        if (esScore) porUsuario[u].score++
        else porUsuario[u].content++
      }

      const dia = r.fecha
      if (!porDia[dia]) porDia[dia] = { score: 0, content: 0 }
      if (esScore) porDia[dia].score++
      else porDia[dia].content++

      const u = r.usuario || 'desconocido'
      if (!ultimaActividad[u] || r.created_at > ultimaActividad[u]) {
        ultimaActividad[u] = r.created_at
      }

      if (r.fecha < primeraFecha) primeraFecha = r.fecha
    }

    const costeHoy = scoreHoy * COSTE_SCORE + contentHoy * COSTE_CONTENT
    const costeMes = scoreMes * COSTE_SCORE + contentMes * COSTE_CONTENT
    const costeTotal = scoreTotal * COSTE_SCORE + contentTotal * COSTE_CONTENT

    // Días transcurridos del mes (mínimo 1 para no dividir por 0)
    const diaDelMes = Math.max(new Date().getDate(), 1)
    const proyeccionMes = (costeMes / diaDelMes) * 30

    // Media diaria histórica
    const msDesdeInicio = Date.now() - new Date(primeraFecha).getTime()
    const diasHistoricos = Math.max(1, Math.ceil(msDesdeInicio / 86400000))
    const mediaDiaria = costeTotal / diasHistoricos

    const modeloMasUsado = scoreTotal >= contentTotal ? 'Haiku 4.5' : 'Sonnet 4.6'

    // Serie de los últimos 7 días (de más antiguo a más reciente)
    const serie7d: { iso: string; label: string; coste: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = isoDia(d)
      const dato = porDia[iso] ?? { score: 0, content: 0 }
      const coste = dato.score * COSTE_SCORE + dato.content * COSTE_CONTENT
      serie7d.push({
        iso,
        label: `${DIAS_SEMANA[d.getDay()]} ${d.getDate()}`,
        coste,
      })
    }
    const maxCoste7d = Math.max(...serie7d.map((s) => s.coste), 0.0001)

    return {
      scoreHoy,
      contentHoy,
      costeHoy,
      scoreMes,
      contentMes,
      costeMes,
      proyeccionMes,
      totalLlamadas: scoreTotal + contentTotal,
      costeTotal,
      mediaDiaria,
      modeloMasUsado,
      porUsuario,
      ultimaActividad,
      serie7d,
      maxCoste7d,
    }
  }, [registros])

  const alertaCoste = m && m.costeMes > 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ maxWidth: 800, margin: '0 auto' }}
    >
      <Cabecera />

      {/* Alerta de coste mensual */}
      {alertaCoste && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            marginBottom: 24,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontSize: 13,
          }}
        >
          <Warning size={18} weight="fill" style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <span>
            Llevas <strong>{fmtEur(m!.costeMes)}</strong> este mes · Considera revisar los
            límites diarios en <code style={codeStyle}>.env</code>
          </span>
        </div>
      )}

      {/* ── SECCIÓN 1 — Uso de Claude API ── */}
      <section style={seccionStyle}>
        <TituloSeccion titulo="Uso de Claude API" />
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: -8, marginBottom: 20 }}>
          Consumo estimado basado en llamadas registradas
        </p>

        {cargando ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sinDatos ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Brain size={40} weight="thin" style={{ color: 'var(--color-text-tertiary)' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 12 }}>
              Aún no hay llamadas registradas
            </p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Las métricas aparecerán cuando uses la IA por primera vez
              {error && ' · No se pudo leer el registro de uso'}
            </p>
          </div>
        ) : (
          <>
            {/* 3 cards de métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {/* HOY */}
              <MetricCard titulo="Hoy">
                <Linea label="Scores realizados" valor={String(m!.scoreHoy)} />
                <Linea label="Contenidos generados" valor={String(m!.contentHoy)} />
                <Linea label="Coste estimado" valor={fmtEur4(m!.costeHoy)} destacado />
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Barra
                    label={`Scores ${m!.scoreHoy}/${LIMITE_SCORE}`}
                    ratio={LIMITE_SCORE ? m!.scoreHoy / LIMITE_SCORE : 0}
                  />
                  <Barra
                    label={`Contenidos ${m!.contentHoy}/${LIMITE_CONTENT}`}
                    ratio={LIMITE_CONTENT ? m!.contentHoy / LIMITE_CONTENT : 0}
                  />
                </div>
              </MetricCard>

              {/* ESTE MES */}
              <MetricCard titulo="Este mes">
                <Linea label="Total scores" valor={String(m!.scoreMes)} />
                <Linea label="Total contenidos" valor={String(m!.contentMes)} />
                <Linea label="Coste estimado" valor={fmtEur(m!.costeMes)} destacado />
                <Linea label="Proyección fin de mes" valor={fmtEur(m!.proyeccionMes)} />
              </MetricCard>

              {/* HISTÓRICO */}
              <MetricCard titulo="Histórico">
                <Linea label="Total llamadas" valor={String(m!.totalLlamadas)} />
                <Linea label="Coste total estimado" valor={fmtEur(m!.costeTotal)} destacado />
                <Linea label="Media diaria" valor={`${fmtEur4(m!.mediaDiaria)}/día`} />
                <Linea label="Modelo más usado" valor={m!.modeloMasUsado} />
              </MetricCard>
            </div>

            {/* Desglose por usuario */}
            {Object.keys(m!.porUsuario).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={subtituloBloque}>Desglose por usuario (este mes)</p>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-2)' }}>
                        <th style={thStyle}>Usuario</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Scores</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Contenidos</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Coste est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(m!.porUsuario).map(([usuario, d]) => (
                        <tr key={usuario} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td style={{ ...tdStyle, fontWeight: 600, textTransform: 'capitalize' }}>{usuario}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.score}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.content}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtEur4(d.score * COSTE_SCORE + d.content * COSTE_CONTENT)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gráfico de consumo 7 días */}
            <div style={{ marginTop: 24 }}>
              <p style={subtituloBloque}>Consumo últimos 7 días</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m!.serie7d.map((d) => (
                  <div key={d.iso} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        width: 56,
                        flexShrink: 0,
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {d.label}
                    </span>
                    <div style={{ flex: 1, height: 18, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max((d.coste / m!.maxCoste7d) * 100, d.coste > 0 ? 4 : 0)}%`,
                          background: 'var(--gradient-brand)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: 56,
                        flexShrink: 0,
                        textAlign: 'right',
                        fontSize: 12,
                        fontWeight: 500,
                        color: d.coste > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtEur4(d.coste)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Enlace a Anthropic Console */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 24,
            padding: 20,
            background: 'rgba(99,102,241,0.04)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
            <Lightning size={20} weight="fill" style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Ver saldo real en Anthropic Console
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                El saldo exacto solo está disponible en tu cuenta de Anthropic
              </p>
            </div>
          </div>
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ minHeight: 44, textDecoration: 'none', flexShrink: 0 }}
          >
            Abrir Console
            <ArrowSquareOut size={16} />
          </a>
        </div>
      </section>

      {/* ── SECCIÓN 2 — Usuarios ── */}
      <SeccionUsuarios ultimaActividad={m?.ultimaActividad ?? {}} porUsuario={m?.porUsuario ?? {}} />

      {/* ── SECCIÓN 3 — Límites diarios ── */}
      <SeccionLimites />

      {/* ── SECCIÓN 4 — Integraciones ── */}
      <SeccionIntegraciones />

      {/* ── SECCIÓN 5 — Voz de IA (ElevenLabs) ── */}
      <SeccionElevenLabs />

      {/* ── SECCIÓN 6 — Plantillas de Email ── */}
      <SeccionPlantillas />
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Cabecera de página
   ───────────────────────────────────────────── */
function Cabecera() {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, lineHeight: 1.2 }}>
        Configuración
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
        Monitor de uso de API, usuarios e integraciones del sistema
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECCIÓN 2 — Usuarios (dinámica desde .env)
   El sistema solo define VITE_AUTH_USER_1/2 (admin + colaborador).
   Se renderiza un card por usuario realmente configurado.
   ───────────────────────────────────────────── */
function SeccionUsuarios({
  ultimaActividad,
  porUsuario,
}: {
  ultimaActividad: Record<string, string>
  porUsuario: Record<string, { score: number; content: number }>
}) {
  // Lee los usuarios configurados (hasta 4 slots; el primero es admin).
  const slots = [
    import.meta.env.VITE_AUTH_USER_1,
    import.meta.env.VITE_AUTH_USER_2,
    import.meta.env.VITE_AUTH_USER_3,
    import.meta.env.VITE_AUTH_USER_4,
  ]
  const usuarios = slots
    .map((u) => (typeof u === 'string' ? u.trim().toLowerCase() : ''))
    .filter(Boolean)
  // Defaults si no hay nada configurado (coinciden con Login.tsx)
  const lista = usuarios.length > 0 ? usuarios : ['jacobo', 'luis']

  return (
    <section style={seccionStyle}>
      <TituloSeccion titulo="Usuarios" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {lista.map((usuario, i) => {
          const esAdmin = i === 0
          const stats = porUsuario[usuario]
          const actividad = ultimaActividad[usuario]
          return (
            <div
              key={usuario}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--gradient-brand)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {usuario.charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', lineHeight: 1.2 }}>
                    {usuario}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>@{usuario}</p>
                </div>
              </div>

              <span
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: esAdmin ? 'var(--color-primary-subtle)' : 'var(--color-surface-2)',
                  color: esAdmin ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  marginBottom: 6,
                }}
              >
                {esAdmin ? 'Administrador' : 'Colaborador'}
              </span>

              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {actividad ? `Última actividad ${formatoFechaHora(actividad)}` : 'Sin actividad registrada'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {stats
                  ? `${stats.score} scores · ${stats.content} contenidos este mes`
                  : '0 scores · 0 contenidos este mes'}
              </p>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 16, lineHeight: 1.5 }}>
        Para añadir usuarios o cambiar contraseñas, edita las variables{' '}
        <code style={codeStyle}>VITE_AUTH_USER_*</code> en Vercel.{' '}
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
          Abrir Vercel →
        </a>
      </p>
    </section>
  )
}

/* ─────────────────────────────────────────────
   SECCIÓN 3 — Límites diarios (solo lectura)
   ───────────────────────────────────────────── */
function SeccionLimites() {
  // Coste máximo/día según los supuestos de tokens del enunciado
  const costeMaxScoreDia = LIMITE_SCORE * COSTE_SCORE
  const costeMaxContentDia = LIMITE_CONTENT * COSTE_CONTENT
  const costeMaxMes = (costeMaxScoreDia + costeMaxContentDia) * 30

  return (
    <section style={seccionStyle}>
      <TituloSeccion titulo="Límites diarios de API" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <LimiteCard
          titulo="Scores por día (Haiku 4.5)"
          valor={LIMITE_SCORE}
          costeMax={costeMaxScoreDia}
          env="VITE_DAILY_SCORE_LIMIT"
        />
        <LimiteCard
          titulo="Contenidos por día (Sonnet 4.6)"
          valor={LIMITE_CONTENT}
          costeMax={costeMaxContentDia}
          env="VITE_DAILY_CONTENT_LIMIT"
        />
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 20,
          background: 'rgba(99,102,241,0.04)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Si alcanzas los límites diarios todos los días:
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 24,
            color: 'var(--color-primary)',
            margin: '6px 0 2px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Coste máximo/mes: {fmtEur(costeMaxMes)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Muy por debajo del coste de herramientas equivalentes
        </p>
      </div>
    </section>
  )
}

function LimiteCard({
  titulo,
  valor,
  costeMax,
  env,
}: {
  titulo: string
  valor: number
  costeMax: number
  env: string
}) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{titulo}</p>
      <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Valor actual</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
      </p>
      <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Coste máximo/día</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEur4(costeMax)}</span>
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
        Para cambiar: edita <code style={codeStyle}>{env}</code> en Vercel
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECCIÓN 4 — Integraciones
   Las keys VITE_* son visibles en cliente; nunca se muestran completas.
   GOOGLE_REFRESH_TOKEN es server-side (Vercel Function): no es legible
   desde el navegador, así que se informa de su naturaleza, no se finge un check.
   ───────────────────────────────────────────── */
interface Integracion {
  icon: typeof Database
  nombre: string
  ok: boolean
  etiquetaOk?: string
  etiquetaKo?: string
  detalle?: string
  serverSide?: boolean
}

function SeccionIntegraciones() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const retellKey = import.meta.env.VITE_RETELL_API_KEY as string | undefined
  const placesKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined

  const integraciones: Integracion[] = [
    {
      icon: Database,
      nombre: 'Supabase',
      ok: !!supabaseUrl,
      etiquetaOk: 'Conectado',
      detalle: supabaseUrl ? truncar(supabaseUrl, 30) : undefined,
    },
    {
      icon: Brain,
      nombre: 'Claude API',
      ok: !!anthropicKey,
      etiquetaOk: 'Configurado',
      detalle: anthropicKey ? maskKey(anthropicKey) : undefined,
    },
    {
      icon: Phone,
      nombre: 'Retell AI',
      ok: !!retellKey,
      etiquetaOk: 'Configurado',
      detalle: retellKey ? 'Voz: custom-Carolina · es_ES' : undefined,
    },
    {
      icon: MapPin,
      nombre: 'Google Places',
      ok: !!placesKey,
      etiquetaOk: 'Configurado',
      etiquetaKo: 'Sin configurar',
    },
    {
      icon: Table,
      nombre: 'Google Sheets',
      // El refresh token vive server-side (Vercel Function) y no es legible aquí.
      // No fingimos un check: informamos de su naturaleza server-side.
      ok: true,
      serverSide: true,
      etiquetaOk: 'Configurado (server-side)',
      detalle: 'OAuth2 server-side · GOOGLE_SETUP.md',
    },
  ]

  return (
    <section style={seccionStyle}>
      <TituloSeccion titulo="Integraciones" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {integraciones.map((it) => (
          <div
            key={it.nombre}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <it.icon size={18} weight="duotone" style={{ color: 'var(--color-text-secondary)' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{it.nombre}</p>
              {it.detalle && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.detalle}
                </p>
              )}
            </div>
            <EstadoBadge
              ok={it.ok}
              textoOk={it.etiquetaOk ?? 'Configurado'}
              textoKo={it.etiquetaKo ?? 'Sin configurar'}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function EstadoBadge({ ok, textoOk, textoKo }: { ok: boolean; textoOk: string; textoKo: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
        color: ok ? 'var(--color-success)' : 'var(--color-error)',
      }}
    >
      {ok ? <CheckCircle size={15} weight="fill" /> : <XCircle size={15} weight="fill" />}
      {ok ? textoOk : textoKo}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Subcomponentes y helpers de presentación
   ───────────────────────────────────────────── */
function TituloSeccion({ titulo }: { titulo: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 16,
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 16,
        marginBottom: 20,
      }}
    >
      {titulo}
    </h2>
  )
}

function MetricCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Linea({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span
        style={{
          fontWeight: destacado ? 700 : 600,
          color: destacado ? 'var(--color-primary)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </span>
    </p>
  )
}

function Barra({ label, ratio }: { label: string; ratio: number }) {
  const r = Math.min(1, Math.max(0, ratio))
  const alLimite = r >= 1
  const cerca = r >= 0.8
  const color = alLimite ? 'var(--color-error)' : cerca ? 'var(--color-warning)' : 'var(--color-primary)'
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</p>
      <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${r * 100}%`,
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Skeleton.Line width="40%" height={12} />
      <Skeleton.Line width="80%" height={14} />
      <Skeleton.Line width="70%" height={14} />
      <Skeleton.Line width="85%" height={14} />
    </div>
  )
}

// ── Helpers puros ──
function maskKey(key: string): string {
  return `${key.slice(0, 8)}••••••••`
}

function truncar(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function formatoFechaHora(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const mismaFecha =
    d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
  if (mismaFecha) return `hoy a las ${hora}`
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} a las ${hora}`
}

// ── Estilos compartidos ──
const seccionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  padding: 24,
  boxShadow: 'var(--shadow-sm)',
  marginBottom: 32,
}

const subtituloBloque: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-tertiary)',
  marginBottom: 10,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-secondary)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.92em',
  background: 'var(--color-surface-2)',
  padding: '1px 6px',
  borderRadius: 4,
}

/* ─────────────────────────────────────────────
   SECCIÓN 5 — Voz de IA (ElevenLabs)
   ───────────────────────────────────────────── */
function SeccionElevenLabs() {
  const [apiKey, setApiKey] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setApiKey(localStorage.getItem('elevenlabs_api_key') || '')
    setVoiceId(localStorage.getItem('elevenlabs_voice_id') || '')
  }, [])

  const guardar = () => {
    localStorage.setItem('elevenlabs_api_key', apiKey)
    localStorage.setItem('elevenlabs_voice_id', voiceId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section style={seccionStyle}>
      <TituloSeccion titulo="Voz de IA (ElevenLabs)" />
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: -8, marginBottom: 20, lineHeight: 1.5 }}>
        Configura tus claves para generar la "Demo Robada" de 30 segundos automáticamente desde QuickView. Las claves se guardan localmente en tu navegador de forma segura.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            ElevenLabs API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{ width: '100%', fontSize: 13, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            Voice ID (El clon de la recepcionista)
          </label>
          <input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder="ej: Xb7hH8..."
            style={{ width: '100%', fontSize: 13, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', outline: 'none' }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
          <button className="btn-primary" onClick={guardar} style={{ padding: '8px 24px' }}>
            <FloppyDisk size={16} /> {saved ? 'Guardadas localmente' : 'Guardar Claves'}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   SECCIÓN 6 — Plantillas de Email
   ───────────────────────────────────────────── */
function SeccionPlantillas() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(false)

  const defaultSubject = 'pregunta rápida'
  const defaultBody = `{{icebreaker}}

{{puntos}}

Si te cuadra, ¿te paso un audio de 30 segundos por WhatsApp para que escuches cómo sonaría con el nombre de {{nombre_negocio}}? Si no encaja, cero compromiso.

Jacobo.`

  useEffect(() => {
    setSubject(localStorage.getItem('email_template_subject') || defaultSubject)
    setBody(localStorage.getItem('email_template_body') || defaultBody)
  }, [])

  const guardar = () => {
    localStorage.setItem('email_template_subject', subject)
    localStorage.setItem('email_template_body', body)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <section style={seccionStyle}>
      <TituloSeccion titulo="Plantillas de Email (1 Clic)" />
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Configura la plantilla por defecto que se abrirá en Gmail. Usa las siguientes variables mágicas:
      </p>
      
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['{{nombre_negocio}}', '{{nombre_decisor}}', '{{ciudad}}', '{{icebreaker}}', '{{puntos}}'].map(tag => (
          <span key={tag} style={{ fontSize: 11, fontWeight: 600, background: 'var(--color-surface-2)', padding: '4px 10px', borderRadius: 'var(--radius-full)', color: 'var(--color-primary)' }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            Asunto
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%', fontSize: 13, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            Cuerpo del mensaje
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: '100%', height: 260, resize: 'vertical', fontSize: 13, padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', outline: 'none', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
          <button className="btn-primary" onClick={guardar} style={{ padding: '8px 24px' }}>
            <FloppyDisk size={16} /> {saved ? 'Guardado' : 'Guardar plantilla'}
          </button>
          <button 
            className="btn-ghost" 
            onClick={() => {
              setSubject(defaultSubject)
              setBody(defaultBody)
              localStorage.removeItem('email_template_subject')
              localStorage.removeItem('email_template_body')
            }} 
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Restaurar estilo Hormozi
          </button>
        </div>
      </div>
    </section>
  )
}
