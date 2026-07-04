import { useEffect, useState } from 'react'
import { Plus, Trash, Quotes } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'
import {
  fetchVoiceExamples, crearVoiceExample, borrarVoiceExample,
  FUENTE_LABELS, type BrandVoiceExample, type VoiceFuente,
} from '../../lib/brandVoice'

/* Voz de marca: pega ejemplos de tu copy real (propuestas, emails, web).
   La IA los usa como referencia de tono al generar el copy de los carruseles. */
export default function VozMarca() {
  const toast = useToast()
  const [ejemplos, setEjemplos] = useState<BrandVoiceExample[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [fuente, setFuente] = useState<VoiceFuente>('email')
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setEjemplos(await fetchVoiceExamples())
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const anadir = async () => {
    if (!texto.trim()) { toast('Pega un ejemplo de copy antes de añadir', 'error'); return }
    setGuardando(true)
    const { error } = await crearVoiceExample(texto.trim(), fuente)
    setGuardando(false)
    if (error) { toast(`Error al guardar: ${error}`, 'error'); return }
    setTexto('')
    toast('Ejemplo añadido', 'success')
    cargar()
  }

  const eliminar = async (id: string) => {
    const prev = ejemplos
    setEjemplos((e) => e.filter((x) => x.id !== id))
    const { error } = await borrarVoiceExample(id)
    if (error) { setEjemplos(prev); toast('Error al borrar', 'error') }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Voz de marca"
        subtitulo="Pega ejemplos de tu copy real. La IA imita este tono al escribir los carruseles."
      />

      <div style={{ maxWidth: 760 }}>
        {/* Formulario de nuevo ejemplo */}
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24 }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder="Pega aquí un email de outreach, un fragmento de propuesta o texto de tu web…"
            style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'var(--font-body)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Fuente</label>
              <select
                value={fuente}
                onChange={(e) => setFuente(e.target.value as VoiceFuente)}
                style={{ height: 40, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14 }}
              >
                {(Object.keys(FUENTE_LABELS) as VoiceFuente[]).map((f) => (
                  <option key={f} value={f}>{FUENTE_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={anadir} disabled={guardando} style={{ gap: 6 }}>
              {guardando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Plus size={15} weight="bold" />}
              Añadir ejemplo
            </button>
          </div>
        </div>

        {/* Lista de ejemplos */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
          </div>
        ) : ejemplos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            Aún no hay ejemplos. Añade el primero arriba.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ejemplos.map((ej) => (
              <div key={ej.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-subtle)', borderRadius: 'var(--radius-full)', padding: '2px 10px' }}>
                    <Quotes size={11} weight="fill" /> {FUENTE_LABELS[ej.fuente]}
                  </span>
                  <button onClick={() => eliminar(ej.id)} aria-label="Borrar ejemplo" className="btn-ghost" style={{ padding: 6, minHeight: 32, minWidth: 32, color: 'var(--color-text-tertiary)' }}>
                    <Trash size={14} />
                  </button>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>{ej.texto_ejemplo}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
