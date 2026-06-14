import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PaperPlaneRight, ArrowClockwise, Trophy, Headset } from '@phosphor-icons/react'
import { simularRespuestaCliente, type ChatMsg } from '../lib/claudeApi'
import { SECTORES, RESISTENCIAS, type Resistencia } from '../lib/simuladorData'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import ChatBurbuja, { EscribiendoDots } from '../components/ChatBurbuja'
import { useToast } from '../components/Toast'

type Estado = 'config' | 'chat' | 'evaluado'

export default function Simulador() {
  const toast = useToast()
  const [estado, setEstado] = useState<Estado>('config')
  const [sectorId, setSectorId] = useState(SECTORES[0].id)
  const [resistencia, setResistencia] = useState<Resistencia>('normal')
  const [historial, setHistorial] = useState<ChatMsg[]>([])
  const [entrada, setEntrada] = useState('')
  const [pensando, setPensando] = useState(false)
  const [evaluacion, setEvaluacion] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const sector = SECTORES.find((s) => s.id === sectorId) ?? SECTORES[0]

  // Auto-scroll al final cuando llega un mensaje o aparece "escribiendo".
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [historial, pensando, evaluacion])

  const iniciar = () => {
    setHistorial([])
    setEvaluacion('')
    setEstado('chat')
  }

  const reiniciar = () => {
    setHistorial([])
    setEvaluacion('')
    setEntrada('')
    setEstado('config')
  }

  const enviar = async () => {
    const texto = entrada.trim()
    if (!texto || pensando) return
    const nuevoHistorial: ChatMsg[] = [...historial, { role: 'user', content: texto }]
    setHistorial(nuevoHistorial)
    setEntrada('')
    setPensando(true)
    try {
      const respuesta = await simularRespuestaCliente(sectorId, resistencia, nuevoHistorial, 'responder')
      setHistorial([...nuevoHistorial, { role: 'assistant', content: respuesta }])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al simular', 'error')
      // Revertimos el último mensaje del usuario para que pueda reintentar.
      setHistorial(historial)
      setEntrada(texto)
    } finally {
      setPensando(false)
    }
  }

  const evaluar = async () => {
    if (historial.length === 0 || pensando) return
    setPensando(true)
    try {
      const feedback = await simularRespuestaCliente(sectorId, resistencia, historial, 'evaluar')
      setEvaluacion(feedback)
      setEstado('evaluado')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al evaluar', 'error')
    } finally {
      setPensando(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Simulador de Ventas"
        subtitulo="Practica tu pitch contra un cliente IA que se resiste. Por sector y dureza."
        acciones={
          estado !== 'config' ? (
            <button className="btn-secondary" onClick={reiniciar}>
              <ArrowClockwise size={16} />
              Reiniciar
            </button>
          ) : undefined
        }
      />

      {/* ── Configuración ── */}
      {estado === 'config' && (
        <div className="card" style={{ padding: 'var(--space-8)', maxWidth: 720 }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Sector del cliente
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SECTORES.map((s) => {
                const activo = s.id === sectorId
                return (
                  <button
                    key={s.id}
                    onClick={() => setSectorId(s.id)}
                    style={{
                      minHeight: 40,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-8)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Nivel de resistencia
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(RESISTENCIAS) as Resistencia[]).map((r) => {
                const activo = r === resistencia
                return (
                  <button
                    key={r}
                    onClick={() => setResistencia(r)}
                    style={{
                      minHeight: 40,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {RESISTENCIAS[r].label}
                  </button>
                )
              })}
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-6)' }}>
            {sector.perfil}
          </p>

          <button className="btn-primary" onClick={iniciar} style={{ minHeight: 44 }}>
            <Headset size={16} />
            Empezar simulación
          </button>
        </div>
      )}

      {/* ── Chat ── */}
      {estado !== 'config' && (
        <div
          className="card"
          style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 420, overflow: 'hidden' }}
        >
          {/* Cabecera del chat */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
              {sector.label}
            </span>
            <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
              {RESISTENCIAS[resistencia].label}
            </span>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--color-surface)' }}>
            {historial.length === 0 && !pensando && (
              <p style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, maxWidth: 320 }}>
                Lanza tu apertura. El cliente responderá según su sector y dureza.
              </p>
            )}
            {historial.map((m, i) => (
              <ChatBurbuja key={i} autor={m.role === 'user' ? 'user' : 'ia'} iaLabel="Cliente">
                {m.content}
              </ChatBurbuja>
            ))}
            {pensando && estado === 'chat' && <EscribiendoDots iaLabel="Cliente" />}

            {/* Evaluación final */}
            {estado === 'evaluado' && evaluacion && (
              <div className="card" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--color-primary)' }}>
                  <Trophy size={18} weight="fill" />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Evaluación</span>
                </div>
                <div className="propuesta-md" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <ReactMarkdown>{evaluacion}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          {estado === 'chat' && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end', background: '#fff' }}>
              <textarea
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escribe tu mensaje al cliente…"
                rows={1}
                style={{ flex: 1, resize: 'none', maxHeight: 120, minHeight: 44, lineHeight: 1.5 }}
              />
              <button
                className="btn-secondary"
                onClick={evaluar}
                disabled={historial.length === 0 || pensando}
                title="Terminar y evaluar"
                style={{ minHeight: 44 }}
              >
                <Trophy size={16} />
                Evaluar
              </button>
              <button
                className="btn-primary"
                onClick={enviar}
                disabled={!entrada.trim() || pensando}
                aria-label="Enviar"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <PaperPlaneRight size={16} weight="fill" />
              </button>
            </div>
          )}

          {estado === 'evaluado' && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: 12, display: 'flex', justifyContent: 'center', background: '#fff' }}>
              <button className="btn-primary" onClick={reiniciar} style={{ minHeight: 44 }}>
                <ArrowClockwise size={16} />
                Nueva simulación
              </button>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  )
}
