import { useEffect, useMemo, useState } from 'react'
import { Newspaper, ArrowSquareOut, Lightbulb, ArrowsClockwise } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import { authHeaders } from '../../lib/supabaseClient'
import { crearIdea } from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Consolidador de noticias del sector (Google News RSS vía /api/news).
   Lista unificada con filtro por tema y "Convertir en idea":
   la noticia entra al backlog del Instagram Manager como punto de partida.
   ───────────────────────────────────────────── */

interface Noticia {
  tema: string
  titulo: string
  url: string
  fuente: string
  fecha: string | null
}

interface Tema { id: string; label: string }

function tiempoRelativo(iso: string | null): string {
  if (!iso) return ''
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (horas < 1) return 'hace menos de 1 h'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export default function Noticias() {
  const toast = useToast()
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [temaFiltro, setTemaFiltro] = useState('todos')
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/news', { headers: await authHeaders() })
      if (!res.ok) throw new Error(`Error ${res.status} cargando noticias`)
      const data = await res.json()
      setNoticias(data.noticias ?? [])
      setTemas(data.temas ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando noticias')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() }, [])

  const visibles = useMemo(
    () => (temaFiltro === 'todos' ? noticias : noticias.filter((n) => n.tema === temaFiltro)),
    [noticias, temaFiltro]
  )

  const temaLabel = (id: string) => temas.find((t) => t.id === id)?.label ?? id

  const convertir = async (n: Noticia) => {
    setConvirtiendo(n.url)
    const { error: err } = await crearIdea({
      titulo: n.titulo.length > 90 ? `${n.titulo.slice(0, 87)}…` : n.titulo,
      formato: 'post',
      estado: 'idea',
      gancho: null,
      caption: `Reacción a noticia del sector (${temaLabel(n.tema)}):\n"${n.titulo}" — ${n.fuente}\n${n.url}\n\nÁngulo WIARE: qué significa esto para clínicas y restaurantes que pierden llamadas.`,
    })
    setConvirtiendo(null)
    if (err) { toast(err, 'error'); return }
    toast('Añadida al backlog del Instagram Manager', 'success')
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Noticias" subtitulo="Actualidad del sector lista para convertirse en contenido" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton.Rect key={i} width="100%" height={64} radius={10} />)}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Noticias"
        subtitulo="Actualidad del sector lista para convertirse en contenido"
        acciones={
          <button className="btn-secondary" onClick={cargar} style={{ fontSize: 13, minHeight: 36 }}>
            <ArrowsClockwise size={14} /> Actualizar
          </button>
        }
      />

      {error ? (
        <div className="card" style={{ padding: 0, maxWidth: 860 }}>
          <EmptyState
            icon={Newspaper}
            titulo="No se pudieron cargar las noticias"
            descripcion={error}
            accion={{ label: 'Reintentar', onClick: cargar }}
          />
        </div>
      ) : noticias.length === 0 ? (
        <div className="card" style={{ padding: 0, maxWidth: 860 }}>
          <EmptyState
            icon={Newspaper}
            titulo="Sin noticias ahora mismo"
            descripcion="Google News no ha devuelto resultados para los temas del sector. Prueba a actualizar en un momento."
            accion={{ label: 'Actualizar', onClick: cargar }}
          />
        </div>
      ) : (
        <>
          {/* Filtro por tema */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {[{ id: 'todos', label: `Todas (${noticias.length})` }, ...temas].map((t) => {
              const activo = temaFiltro === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTemaFiltro(t.id)}
                  aria-pressed={activo}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 13,
                    fontWeight: activo ? 600 : 500,
                    border: 'none',
                    minHeight: 'auto',
                    background: activo ? 'var(--color-primary-subtle)' : 'transparent',
                    color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Lista */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: 860 }}>
            {visibles.map((n, i) => (
              <div
                key={n.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none', display: 'block', lineHeight: 1.4 }}
                  >
                    {n.titulo}
                  </a>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {n.fuente && <>{n.fuente} · </>}{temaLabel(n.tema)}{n.fecha && <> · {tiempoRelativo(n.fecha)}</>}
                  </span>
                </div>
                <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => convertir(n)}
                    disabled={convirtiendo === n.url}
                    aria-label={`Convertir en idea: ${n.titulo}`}
                    title="Convertir en idea de post (va al backlog)"
                    style={{ padding: 6, minHeight: 30, minWidth: 30, color: 'var(--color-primary)' }}
                  >
                    {convirtiendo === n.url
                      ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                      : <Lightbulb size={14} weight="fill" />}
                  </button>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                    aria-label={`Abrir: ${n.titulo}`}
                    title="Leer la noticia"
                    style={{ padding: 6, minHeight: 30, minWidth: 30 }}
                  >
                    <ArrowSquareOut size={14} />
                  </a>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </PageTransition>
  )
}
