import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Sparkle, Trash, CaretLeft, CaretRight } from '@phosphor-icons/react'
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

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Todos los leads <span style={{ fontSize: 16, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>({filtrados.length})</span></h1>
        {sinScoreCount > 0 && !batch && (
          <button className="btn-gradient" onClick={cualificarTodos}>
            <Sparkle size={16} weight="fill" style={{ verticalAlign: -2, marginRight: 6 }} />
            Cualificar todos sin score ({sinScoreCount})
          </button>
        )}
      </div>

      {batch && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <LoadingBar progress={(batch.actual / batch.total) * 100} label={`Cualificando lead ${batch.actual} de ${batch.total}…`} />
        </div>
      )}

      {error && <p style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>⚠️ {error}</p>}

      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Buscar por nombre…"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          style={{ flex: '1 1 200px' }}
        />
        <select value={sectorFiltro} onChange={(e) => { setSectorFiltro(e.target.value); setPagina(1) }}>
          <option value="todos">Todos los sectores</option>
          {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="recientes">Más recientes</option>
          <option value="score">Mayor score</option>
          <option value="resenas">Más reseñas</option>
          <option value="mrr">Mayor MRR</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          Score ≥ {scoreMin}
          <input
            type="range"
            min={0}
            max={10}
            value={scoreMin}
            onChange={(e) => { setScoreMin(Number(e.target.value)); setPagina(1) }}
            style={{ width: 110, accentColor: 'var(--accent-primary)', minHeight: 44 }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['todas', ...FASES].map((f) => (
          <button
            key={f}
            onClick={() => { setFaseFiltro(f); setPagina(1) }}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              background: faseFiltro === f ? 'var(--accent-primary)' : '#fff',
              color: faseFiltro === f ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {f === 'todas' ? 'Todas' : FASE_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              {['Score', 'Nombre', 'Sector', 'Ciudad', 'Teléfono', 'Reseñas', 'Val.', 'Fase', 'Acciones'].map((h) => (
                <th key={h} style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((lead) => (
              <tr
                key={lead.id}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <td style={{ padding: '12px 16px' }}><ScoreBadge score={lead.score_cualificacion} size="sm" /></td>
                <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: 220 }}>{lead.nombre}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{lead.sector}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{lead.ciudad}</td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{lead.telefono ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>{lead.num_resenas ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>{lead.valoracion ? `⭐${lead.valoracion}` : '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{FASE_LABELS[lead.fase] ?? lead.fase}</td>
                <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Ver" className="btn-ghost" style={{ padding: 8, minHeight: 36 }} onClick={() => navigate(`/leads/${lead.id}`)}>
                      <Eye size={16} />
                    </button>
                    <button
                      title="Cualificar"
                      className="btn-ghost"
                      style={{ padding: 8, minHeight: 36, color: 'var(--accent-primary)' }}
                      disabled={scoringId === lead.id || !!batch}
                      onClick={() => cualificar(lead)}
                    >
                      {scoringId === lead.id ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Sparkle size={16} />}
                    </button>
                    <button title="Descartar" className="btn-ghost" style={{ padding: 8, minHeight: 36, color: 'var(--red)' }} onClick={() => descartar(lead)}>
                      <Trash size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No hay leads con esos filtros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button className="btn-ghost" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
            <CaretLeft size={16} />
          </button>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
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
