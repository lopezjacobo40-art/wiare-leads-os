import { useEffect, useMemo, useState } from 'react'
import {
  Newspaper, ArrowSquareOut, Lightbulb, ArrowsClockwise,
  CheckCircle, MinusCircle,
} from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { authHeaders } from '../../lib/supabaseClient'
import { crearIdea } from '../../lib/contentIdeas'
import { aconsejarNoticias, type ConsejoNoticia } from '../../lib/claudeApi'

/* ─────────────────────────────────────────────
   Consolidador de noticias del sector (Google News RSS vía /api/news).
   Cards por noticia con tema, fuente y antigüedad; "Consejo IA" marca
   qué titulares sirven para crear contenido de WIARE (soluciones IA
   para negocios locales) y "Convertir en idea" los manda al backlog.
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
  const { brand } = useBrandKit()
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [temaFiltro, setTemaFiltro] = useState('todos')
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null)
  const [consejos, setConsejos] = useState<Record<string, ConsejoNoticia>>({})
  const [aconsejando, setAconsejando] = useState(false)

  const indigo = brand?.colores.indigo ?? '#6366F1'
  const cyan = brand?.colores.cyan ?? '#22D3EE'

  // Color de chip por tema, dentro de la paleta de marca
  const colorTema = (id: string): string => {
    if (id === 'ia_voz') return indigo
    if (id === 'ia_soluciones') return cyan
    if (id === 'automatizacion') return '#8B5CF6'
    if (id === 'ia_negocio') return '#0EA5E9'
    if (id === 'clinicas') return '#16A34A'
    if (id === 'hosteleria') return '#F59E0B'
    return '#71717A'
  }

  const cargar = async () => {
    setLoading(true)
    setError('')
    setConsejos({})
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

  const visibles = useMemo(() => {
    const lista = temaFiltro === 'todos' ? noticias : noticias.filter((n) => n.tema === temaFiltro)
    if (Object.keys(consejos).length === 0) return lista
    // Con consejo: las aptas primero
    return [...lista].sort((a, b) => {
      const va = consejos[a.url]?.veredicto === 'apto' ? 0 : 1
      const vb = consejos[b.url]?.veredicto === 'apto' ? 0 : 1
      return va - vb
    })
  }, [noticias, temaFiltro, consejos])

  const temaLabel = (id: string) => temas.find((t) => t.id === id)?.label ?? id

  const pedirConsejo = async () => {
    if (noticias.length === 0) return
    setAconsejando(true)
    try {
      const resultado = await aconsejarNoticias(
        noticias.map((n) => ({ titulo: n.titulo, fuente: n.fuente })),
        brand?.tono_voz
      )
      const mapa: Record<string, ConsejoNoticia> = {}
      for (const c of resultado) {
        const noticia = noticias[c.indice]
        if (noticia) mapa[noticia.url] = c
      }
      setConsejos(mapa)
      const nAptas = resultado.filter((c) => c.veredicto === 'apto').length
      toast(`Consejo listo: ${nAptas} de ${noticias.length} noticias sirven para contenido`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error analizando las noticias', 'error')
    } finally {
      setAconsejando(false)
    }
  }

  const convertir = async (n: Noticia) => {
    setConvirtiendo(n.url)
    const consejo = consejos[n.url]
    const { error: err } = await crearIdea({
      titulo: n.titulo.length > 90 ? `${n.titulo.slice(0, 87)}…` : n.titulo,
      formato: 'post',
      estado: 'idea',
      gancho: consejo?.razon || null,
      caption: `Reacción a noticia del sector (${temaLabel(n.tema)}):\n"${n.titulo}" — ${n.fuente}\n${n.url}\n\nÁngulo WIARE: ${consejo?.razon || 'qué significa esto para clínicas y restaurantes que pierden llamadas.'}`,
    })
    setConvirtiendo(null)
    if (err) { toast(err, 'error'); return }
    toast('Añadida al backlog del Instagram Manager', 'success')
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Noticias" subtitulo="Actualidad de IA y negocios locales lista para convertirse en contenido" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Noticias"
        subtitulo="Actualidad de IA y negocios locales lista para convertirse en contenido"
        acciones={
          <div style={{ display: 'flex', gap: 8 }}>
            {noticias.length > 0 && (
              <button
                className="btn-primary"
                onClick={pedirConsejo}
                disabled={aconsejando}
                title="La IA marca qué titulares sirven para crear contenido de WIARE"
                style={{ fontSize: 13, minHeight: 36 }}
              >
                {aconsejando
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Analizando…</>
                  : <><Lightbulb size={14} weight="fill" /> Consejo IA</>}
              </button>
            )}
            <button className="btn-secondary" onClick={cargar} style={{ fontSize: 13, minHeight: 36 }}>
              <ArrowsClockwise size={14} /> Actualizar
            </button>
          </div>
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
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap' }}>
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

          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {visibles.map((n) => {
              const c = colorTema(n.tema)
              const consejo = consejos[n.url]
              const esApta = consejo?.veredicto === 'apto'
              return (
                <article
                  key={n.url}
                  className="card"
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    border: esApta ? '1px solid color-mix(in srgb, var(--color-success) 45%, transparent)' : undefined,
                    opacity: consejo && !esApta ? 0.68 : 1,
                    transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1), border-color 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: c,
                      background: `color-mix(in srgb, ${c} 10%, transparent)`,
                      borderRadius: 'var(--radius-full)', padding: '3px 10px',
                    }}>
                      {temaLabel(n.tema)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                      {tiempoRelativo(n.fecha)}
                    </span>
                  </div>

                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      lineHeight: 1.35,
                      letterSpacing: '-0.01em',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.titulo}
                  </a>

                  {/* Veredicto IA */}
                  {consejo && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '8px 10px', borderRadius: 'var(--radius-md)',
                      background: esApta
                        ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
                        : 'var(--color-surface-2)',
                    }}>
                      {esApta
                        ? <CheckCircle size={15} weight="fill" color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <MinusCircle size={15} weight="fill" color="var(--color-text-tertiary)" style={{ flexShrink: 0, marginTop: 1 }} />}
                      <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-text-primary)' }}>
                        <strong style={{ color: esApta ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                          {esApta ? 'Apta para contenido' : 'Pasar'}
                        </strong>
                        {consejo.razon && <> — {consejo.razon}</>}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.fuente || 'Google News'}
                    </span>
                    <button
                      className={esApta ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => convertir(n)}
                      disabled={convirtiendo === n.url}
                      title="Convertir en idea de post (va al backlog)"
                      style={{ fontSize: 12, padding: '5px 12px', minHeight: 32 }}
                    >
                      {convirtiendo === n.url
                        ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                        : <Lightbulb size={13} weight={esApta ? 'fill' : 'regular'} />}
                      Idea
                    </button>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      aria-label={`Leer: ${n.titulo}`}
                      title="Leer la noticia"
                      style={{ padding: 6, minHeight: 32, minWidth: 32 }}
                    >
                      <ArrowSquareOut size={14} />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </PageTransition>
  )
}
