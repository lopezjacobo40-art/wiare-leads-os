import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkle, Copy, ArrowsClockwise, PenNib, LinkedinLogo } from '@phosphor-icons/react'
import { generarPostLinkedIn } from '../lib/claudeApi'
import { ANGULOS, TONOS, LONGITUDES, type TonoContenido, type LongitudId } from '../lib/contenidoData'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'

interface PostGenerado {
  id: number
  texto: string
  anguloLabel: string
}

let nextId = 1

export default function Contenido() {
  const toast = useToast()
  const [anguloId, setAnguloId] = useState(ANGULOS[0].id)
  const [tono, setTono] = useState<TonoContenido>('cercano')
  const [longitud, setLongitud] = useState<LongitudId>('medio')
  const [generando, setGenerando] = useState(false)
  const [posts, setPosts] = useState<PostGenerado[]>([])

  const angulo = ANGULOS.find((a) => a.id === anguloId) ?? ANGULOS[0]

  const generar = async () => {
    if (generando) return
    setGenerando(true)
    try {
      const texto = await generarPostLinkedIn(anguloId, tono, longitud)
      setPosts((prev) => [{ id: nextId++, texto, anguloLabel: angulo.label }, ...prev])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar', 'error')
    } finally {
      setGenerando(false)
    }
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast('Post copiado al portapapeles', 'success')
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Generador de Contenido"
        subtitulo="Posts de LinkedIn sobre casos de uso de WIARE para captación orgánica."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 'var(--space-6)', alignItems: 'start' }} className="contenido-grid">
        {/* ── Panel de opciones ── */}
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Ángulo
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ANGULOS.map((a) => {
                const activo = a.id === anguloId
                return (
                  <button
                    key={a.id}
                    onClick={() => setAnguloId(a.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                      minHeight: 44,
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: activo ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                      {a.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {a.descripcion}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Tono
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(TONOS) as TonoContenido[]).map((tn) => {
                const activo = tn === tono
                return (
                  <button
                    key={tn}
                    onClick={() => setTono(tn)}
                    style={{
                      minHeight: 40, padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500,
                      border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {TONOS[tn].label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Longitud
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(LONGITUDES) as LongitudId[]).map((lg) => {
                const activo = lg === longitud
                return (
                  <button
                    key={lg}
                    onClick={() => setLongitud(lg)}
                    style={{
                      minHeight: 40, padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500,
                      border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      background: activo ? 'var(--color-primary-subtle)' : '#fff',
                      color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {LONGITUDES[lg].label}
                  </button>
                )
              })}
            </div>
          </div>

          <button className="btn-primary" onClick={generar} disabled={generando} style={{ minHeight: 44 }}>
            <Sparkle size={16} weight="fill" />
            {generando ? 'Generando…' : posts.length > 0 ? 'Generar otro' : 'Generar post'}
          </button>
        </div>

        {/* ── Resultado ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>
          {generando && (
            <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton.Line width="70%" height={16} />
              <Skeleton.Line width="100%" />
              <Skeleton.Line width="92%" />
              <Skeleton.Line width="60%" />
              <Skeleton.Line width="80%" />
            </div>
          )}

          {!generando && posts.length === 0 && (
            <EmptyState
              icon={PenNib}
              titulo="Aún no has generado nada"
              descripcion="Elige un ángulo, tono y longitud, y genera tu primer post de LinkedIn."
            />
          )}

          {posts.map((post) => (
            <div key={post.id} className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                  <LinkedinLogo size={13} weight="fill" />
                  {post.anguloLabel}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => copiar(post.texto)} style={{ minHeight: 36 }}>
                    <Copy size={15} />
                    Copiar
                  </button>
                  <button className="btn-ghost" onClick={generar} disabled={generando} style={{ minHeight: 36 }}>
                    <ArrowsClockwise size={15} />
                    Regenerar
                  </button>
                </div>
              </div>
              <div
                className="propuesta-md"
                style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                <ReactMarkdown>{post.texto}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
