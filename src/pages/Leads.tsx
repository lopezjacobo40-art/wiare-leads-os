import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Lightning, X, Sparkle, Star, CaretLeft, CaretRight, DotsThree } from '@phosphor-icons/react'
import { supabase, type Lead, FASES, FASE_LABELS } from '../lib/supabaseClient'
import { scoreLead } from '../lib/claudeApi'
import ScoreBadge from '../components/ScoreBadge'
import LoadingBar from '../components/LoadingBar'

const PAGE_SIZE = 25
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [sectorFiltro, setSectorFiltro] = useState('todos')
  const [faseFiltro, setFaseFiltro] = useState('todas')
  const [scoreMin, setScoreMin] = useState(0)
  const [orden, setOrden] = useState('recientes')
  const [pagina, setPagina] = useState(1)

  const [scoringId, setScoringId] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ actual: number; total: number } | null>(null)
  const [menuFilaId, setMenuFilaId] = useState<string | null>(null) // acciones extra abiertas en móvil

  const cargar = async () => {
    const { data, error: err } = await supabase
      .from('leads_os')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setLeads(data as Lead[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const sectores = useMemo(
    () => [...new Set(leads.map((l) => l.sector))].sort(),
    [leads]
  )

  const filtrados = useMemo(() => {
    let res = leads.filter((l) => {
      if (busqueda && !l.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (sectorFiltro !== 'todos' && l.sector !== sectorFiltro) return false
      if (faseFiltro !== 'todas' && l.fase !== faseFiltro) return false
      if (scoreMin > 0 && (l.score_cualificacion ?? -1) < scoreMin) return false
      return true
    })
    if (orden === 'score') res = [...res].sort((a, b) => (b.score_cualificacion ?? -1) - (a.score_cualificacion ?? -1))
    else if (orden === 'resenas') res = [...res].sort((a, b) => (b.num_resenas ?? 0) - (a.num_resenas ?? 0))
    else if (orden === 'mrr') res = [...res].sort((a, b) => (b.mrr_estimado ?? 0) - (a.mrr_estimado ?? 0))
    return res
  }, [leads, busqueda, sectorFiltro, faseFiltro, scoreMin, orden])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  const cualificar = async (lead: Lead) => {
    setScoringId(lead.id)
    setError('')
    try {
      const r = await scoreLead(lead)
      const { error: err } = await supabase
        .from('leads_os')
        .update({
          score_cualificacion: r.score,
          motivo_score: r.motivo,
          volumen_llamadas: r.volumen,
          mrr_estimado: r.mrr,
          fase: lead.fase === 'nuevo' ? 'cualificado' : lead.fase,
        })
        .eq('id', lead.id)
      if (err) throw err
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cualificar')
    } finally {
      setScoringId(null)
    }
  }

  const cualificarTodos = async () => {
    const sinScore = leads.filter((l) => l.score_cualificacion == null)
    if (sinScore.length === 0) return
    setBatch({ actual: 0, total: sinScore.length })
    setError('')
    for (let i = 0; i < sinScore.length; i++) {
      setBatch({ actual: i + 1, total: sinScore.length })
      try {
        const r = await scoreLead(sinScore[i])
        await supabase
          .from('leads_os')
          .update({
            score_cualificacion: r.score,
            motivo_score: r.motivo,
            volumen_llamadas: r.volumen,
            mrr_estimado: r.mrr,
            fase: sinScore[i].fase === 'nuevo' ? 'cualificado' : sinScore[i].fase,
          })
          .eq('id', sinScore[i].id)
      } catch {
        // continúa con el siguiente lead
      }
      await delay(500)
    }
    setBatch(null)
    await cargar()
  }

  const descartar = async (lead: Lead) => {
    if (!confirm(`¿Descartar "${lead.nombre}"? Se eliminará de la lista.`)) return
    const { error: err } = await supabase.from('leads_os').delete().eq('id', lead.id)
    if (err) setError(err.message)
    else await cargar()
  }

  const sinScoreCount = leads.filter((l) => l.score_cualificacion == null).length

  const inputStyle: React.CSSProperties = {
    height: 32,
    minHeight: 32,
    fontSize: 13,
    padding: '0 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>
          Todos los leads{' '}
          <span style={{ fontSize: 16, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
            ({filtrados.length})
          </span>
        </h1>
        {sinScoreCount > 0 && !batch && (
          <button className="btn-secondary" onClick={cualificarTodos}>
            <Sparkle size={16} weight="fill" />
            Cualificar selección ({sinScoreCount})
          </button>
        )}
      </div>

      {batch && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <LoadingBar progress={(batch.actual / batch.total) * 100} label={`Cualificando lead ${batch.actual} de ${batch.total}…`} />
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--color-error)', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} /> {error}
        </p>
      )}

      {/* Filtros */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          placeholder="Buscar por nombre…"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          style={{ ...inputStyle, flex: '1 1 200px' }}
        />
        <select value={sectorFiltro} onChange={(e) => { setSectorFiltro(e.target.value); setPagina(1) }} style={inputStyle}>
          <option value="todos">Todos los sectores</option>
          {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} style={inputStyle}>
          <option value="recientes">Más recientes</option>
          <option value="score">Mayor score</option>
          <option value="resenas">Más reseñas</option>
          <option value="mrr">Mayor MRR</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Score ≥ {scoreMin}
          <input
            type="range"
            min={0}
            max={10}
            value={scoreMin}
            onChange={(e) => { setScoreMin(Number(e.target.value)); setPagina(1) }}
            style={{ width: 110, accentColor: 'var(--color-primary)', minHeight: 'auto' }}
          />
        </label>
      </div>

      {/* Tabs de fase */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todas', ...FASES].map((f) => {
          const activo = faseFiltro === f
          return (
            <button
              key={f}
              onClick={() => { setFaseFiltro(f); setPagina(1) }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                minHeight: 'auto',
                background: activo ? 'var(--color-primary-subtle)' : 'transparent',
                color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {f === 'todas' ? 'Todas' : FASE_LABELS[f]}
            </button>
          )
        })}
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                {[
                  { label: 'Score' },
                  { label: 'Nombre' },
                  { label: 'Sector' },
                  { label: 'Ciudad' },
                  { label: 'Teléfono' },
                  { label: 'Reseñas', cls: 'col-resenas' },
                  { label: 'Val.', cls: 'col-valoracion' },
                  { label: 'Fase' },
                  { label: 'Acciones' },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={h.cls}
                    style={{
                      padding: '0 16px',
                      height: 36,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((lead) => (
                <tr
                  key={lead.id}
                  style={{
                    height: 52,
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0 16px' }}><ScoreBadge score={lead.score_cualificacion} size="sm" /></td>
                  <td style={{ padding: '0 16px', fontWeight: 500, maxWidth: 220, color: 'var(--color-text-primary)' }}>{lead.nombre}</td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)' }}>{lead.sector}</td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)' }}>{lead.ciudad}</td>
                  <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>{lead.telefono ?? '—'}</td>
                  <td className="col-resenas" style={{ padding: '0 16px' }}>{lead.num_resenas ?? '—'}</td>
                  <td className="col-valoracion" style={{ padding: '0 16px' }}>
                    {lead.valoracion ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Star size={13} weight="fill" style={{ color: 'var(--color-warning)' }} /> {lead.valoracion}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{FASE_LABELS[lead.fase] ?? lead.fase}</td>
                  <td style={{ padding: '0 16px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button title="Ver detalle" className="btn-ghost" style={{ padding: 8, minHeight: 36, minWidth: 36 }} onClick={() => navigate(`/leads/${lead.id}`)}>
                        <Eye size={16} />
                      </button>
                      <button
                        title="Cualificar"
                        className={`btn-ghost acciones-extra${menuFilaId === lead.id ? ' show' : ''}`}
                        style={{ padding: 8, minHeight: 36, minWidth: 36 }}
                        disabled={scoringId === lead.id || !!batch}
                        onClick={() => cualificar(lead)}
                      >
                        {scoringId === lead.id ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Lightning size={16} />}
                      </button>
                      <button
                        title="Descartar"
                        className={`btn-ghost acciones-extra${menuFilaId === lead.id ? ' show' : ''}`}
                        style={{ padding: 8, minHeight: 36, minWidth: 36, color: 'var(--color-error)' }}
                        onClick={() => descartar(lead)}
                      >
                        <X size={16} />
                      </button>
                      <button
                        title="Más acciones"
                        className="btn-ghost acciones-menu-btn"
                        style={{ padding: 8, minHeight: 36, minWidth: 36 }}
                        onClick={() => setMenuFilaId(menuFilaId === lead.id ? null : lead.id)}
                      >
                        <DotsThree size={18} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hay leads con esos filtros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button className="btn-ghost" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
            <CaretLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Página {paginaActual} de {totalPaginas}
          </span>
          <button className="btn-ghost" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
            <CaretRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
