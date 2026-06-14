import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PaperPlaneRight, Plus, Lightning, ChatCircleDots } from '@phosphor-icons/react'
import { consultarIA, type ChatMsg } from '../lib/claudeApi'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import ChatBurbuja, { EscribiendoDots } from '../components/ChatBurbuja'
import { useToast } from '../components/Toast'

const SUGERENCIAS = [
  '¿Cómo respondo a "es muy caro"?',
  'Dame el pitch para una clínica dental',
  '¿Qué incluye exactamente el setup?',
  '¿Cómo justifico el mantenimiento mensual?',
]

export default function Consultor() {
  const toast = useToast()
  const [historial, setHistorial] = useState<ChatMsg[]>([])
  const [entrada, setEntrada] = useState('')
  const [pensando, setPensando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [historial, pensando])

  const nuevaConversacion = () => {
    setHistorial([])
    setEntrada('')
  }

  const enviarTexto = async (texto: string) => {
    const limpio = texto.trim()
    if (!limpio || pensando) return
    const nuevoHistorial: ChatMsg[] = [...historial, { role: 'user', content: limpio }]
    setHistorial(nuevoHistorial)
    setEntrada('')
    setPensando(true)
    try {
      const respuesta = await consultarIA(nuevoHistorial)
      setHistorial([...nuevoHistorial, { role: 'assistant', content: respuesta }])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al consultar', 'error')
      setHistorial(historial)
      setEntrada(limpio)
    } finally {
      setPensando(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarTexto(entrada)
    }
  }

  const vacio = historial.length === 0

  return (
    <PageTransition>
      <PageHeader
        titulo="Consultor IA"
        subtitulo="Dudas rápidas sobre WIARE: pitch, objeciones, precios y proceso."
        acciones={
          !vacio ? (
            <button className="btn-secondary" onClick={nuevaConversacion}>
              <Plus size={16} />
              Nueva conversación
            </button>
          ) : undefined
        }
      />

      <div
        className="card"
        style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 420, overflow: 'hidden' }}
      >
        {/* Mensajes */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--color-surface)' }}>
          {vacio && !pensando ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <span
                style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}
              >
                <ChatCircleDots size={24} weight="fill" />
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
                ¿En qué te ayudo?
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
                Pregunta lo que necesites o empieza por una de estas:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviarTexto(s)}
                    className="badge"
                    style={{
                      background: '#fff',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-strong)',
                      cursor: 'pointer',
                      minHeight: 36,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    <Lightning size={13} weight="fill" style={{ color: 'var(--color-primary)' }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {historial.map((m, i) => (
                <ChatBurbuja key={i} autor={m.role === 'user' ? 'user' : 'ia'} iaLabel="Consultor">
                  {m.role === 'assistant' ? (
                    <div className="propuesta-md" style={{ fontSize: 14, lineHeight: 1.55 }}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </ChatBurbuja>
              ))}
              {pensando && <EscribiendoDots iaLabel="Consultor" />}
            </>
          )}
        </div>

        {/* Composer */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end', background: '#fff' }}>
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu duda…"
            rows={1}
            style={{ flex: 1, resize: 'none', maxHeight: 120, minHeight: 44, lineHeight: 1.5 }}
          />
          <button
            className="btn-primary"
            onClick={() => enviarTexto(entrada)}
            disabled={!entrada.trim() || pensando}
            aria-label="Enviar"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </div>
      </div>
    </PageTransition>
  )
}
