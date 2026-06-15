import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Lightning, X, Sparkle, Star, CaretLeft, CaretRight, DotsThree, MagnifyingGlass, Users, Trash, ArrowRight, Globe, Copy, ArrowClockwise } from '@phosphor-icons/react'
import { supabase, type Lead, FASES, FASE_LABELS } from '../lib/supabaseClient'
import { scoreLead } from '../lib/claudeApi'
import { processBatch, estimarCoste, BATCH_CONFIRM_THRESHOLD } from '../lib/tokenGuard'
import ScoreBadge from '../components/ScoreBadge'
import LoadingBar from '../components/LoadingBar'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'
import ExportSheet from '../components/ExportSheet'
import QuickView from '../components/QuickView'
import Skeleton from '../components/Skeleton'
import FuenteBadge from '../components/FuenteBadge'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 25
const DIAS_7_MS = 7 * 24 * 60 * 60 * 1000

// ¿El lead es "caliente sin trabajar"? (score≥7 + fase nuevo)
const esCalienteSinTrabajar = (l: Lead) => (l.score_cualificacion ?? 0) >= 7 && l.fase === 'nuevo'
// ¿Demo creada pero sin propuesta?
const esDemoSinPropuesta = (l: Lead) => l.fase === 'demo_creada' && !l.propuesta_md
// ¿Sin actividad (creado hace >7d y aún en fase nuevo)?
const esInactivo = (l: Lead) => l.fase === 'nuevo' && Date.now() - new Date(l.created_at).getTime() > DIAS_7_MS

export default function Leads() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [sectorFiltro, setSectorFiltro] = useState('todos')
  const [faseFiltro, setFaseFiltro] = useState('todas')
  const [fuenteFiltro, setFuenteFiltro] = useState('todos') // 'todos' | 'web_calculadora' | 'extraccion'
  const [scoreMin, setScoreMin] = useState(0)
  const [orden, setOrden] = useState('prioridad')
  const [pagina, setPagina] = useState(1)
  // Filtros especiales activados por deep-link desde el Dashboard.
  const [soloSinPropuesta, setSoloSinPropuesta] = useState(false)
  const [soloInactivos, setSoloInactivos] = useState(false)

  const [scoringId, setScoringId] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ actual: number; total: number } | null>(null)
  const [menuFilaId, setMenuFilaId] = useState<string | null>(null) // acciones extra abiertas en móvil
  const [confirmBatch, setConfirmBatch] = useState<number | null>(null) // nº de leads pendientes de confirmar
  const [leadADescartar, setLeadADescartar] = useState<Lead | null>(null) // lead pendiente de confirmar descarte

  // Selección en lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [faseDropdownOpen, setFaseDropdownOpen] = useState(false)
  const [aplicandoLote, setAplicandoLote] = useState(false)

  // Vista rápida (panel lateral)
  const [quickViewLead, setQuickViewLead] = useState<Lead | null>(null)

  // Eliminar en lote
  const [confirmEliminarLote, setConfirmEliminarLote] = useState(false)
  const [eliminandoLote, setEliminandoLote] = useState(false)

  const [extraccionFiltro, setExtraccionFiltro] = useState<string | null>(null)
  const [buscandoEmail, setBuscandoEmail] = useState<string | null>(null)
  const [confirmRescorar, setConfirmRescorar] = useState(false)
  const [rescorando, setRescorando] = useState(false)

  // ── Lee los query params al montar y preconfigura los filtros (deep-link). ──
  useEffect(() => {
    const sm = searchParams.get('score_min')
    const f = searchParams.get('fase')
    const sp = searchParams.get('sin_propuesta')
    const inact = searchParams.get('inactivo')
    const fu = searchParams.get('fuente')
    const ext = searchParams.get('extraccion')
    if (sm) setScoreMin(Number(sm))
    if (f) setFaseFiltro(f)
    if (sp) setSoloSinPropuesta(true)
    if (inact) setSoloInactivos(true)
    if (fu) setFuenteFiltro(fu)
    if (ext) setExtraccionFiltro(ext)
    if (sm || f || sp || inact || fu || ext) {
      setOrden('prioridad')
      // Limpia la URL para no "fijar" el filtro al recargar manualmente.
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargar = async (extId?: string | null) => {
    let q = supabase.from('leads_os').select('*')
    const filtroExt = extId !== undefined ? extId : extraccionFiltro
    if (filtroExt) {
      q = q.eq('extraccion_id', filtroExt).order('score_cualificacion', { ascending: false, nullsFirst: false })
    } else {
      q = q.order('created_at', { ascending: false })
    }
    const { data, error: err } = await q
    if (err) setError(err.message)
    else setLeads(data as Lead[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [extraccionFiltro])

  const sectores = useMemo(
    () => [...new Set(leads.map((l) => l.sector))].sort(),
    [leads]
  )

  const filtrados = useMemo(() => {
    let res = leads.filter((l) => {
      if (busqueda && !l.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (sectorFiltro !== 'todos' && l.sector !== sectorFiltro) return false
      if (faseFiltro !== 'todas' && l.fase !== faseFiltro) return false
      if (fuenteFiltro === 'web_calculadora' && l.fuente !== 'web_calculadora') return false
      // 'extraccion' = todo lo que no es lead web (los leads antiguos tienen fuente null pero son extracción)
      if (fuenteFiltro === 'extraccion' && l.fuente === 'web_calculadora') return false
      if (scoreMin > 0 && (l.score_cualificacion ?? -1) < scoreMin) return false
      if (soloSinPropuesta && l.propuesta_md) return false
      if (soloInactivos && !esInactivo(l)) return false
      return true
    })
    // Filtro web → los más urgentes primero (mayor pérdida real)
    if (fuenteFiltro === 'web_calculadora') {
      res = [...res].sort((a, b) => (b.perdida_mensual_real ?? 0) - (a.perdida_mensual_real ?? 0))
    } else if (orden === 'prioridad') {
      // 1º calientes sin trabajar, 2º demo sin propuesta, 3º resto por score desc
      res = [...res].sort((a, b) => prioridad(a) - prioridad(b) || (b.score_cualificacion ?? -1) - (a.score_cualificacion ?? -1))
    } else if (orden === 'score') res = [...res].sort((a, b) => (b.score_cualificacion ?? -1) - (a.score_cualificacion ?? -1))
    else if (orden === 'resenas') res = [...res].sort((a, b) => (b.num_resenas ?? 0) - (a.num_resenas ?? 0))
    else if (orden === 'mrr') res = [...res].sort((a, b) => (b.mrr_estimado ?? 0) - (a.mrr_estimado ?? 0))
    return res
  }, [leads, busqueda, sectorFiltro, faseFiltro, fuenteFiltro, scoreMin, orden, soloSinPropuesta, soloInactivos])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  const hayFiltros =
    busqueda !== '' || sectorFiltro !== 'todos' || faseFiltro !== 'todas' ||
    fuenteFiltro !== 'todos' || scoreMin > 0 || soloSinPropuesta || soloInactivos
  const limpiarFiltros = () => {
    setBusqueda('')
    setSectorFiltro('todos')
    setFaseFiltro('todas')
    setFuenteFiltro('todos')
    setScoreMin(0)
    setSoloSinPropuesta(false)
    setSoloInactivos(false)
    setPagina(1)
  }

  // ── Selección en lote ──
  const visiblesIds = visibles.map((l) => l.id)
  const allVisibleSelected = visiblesIds.length > 0 && visiblesIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0 && !allVisibleSelected

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const handleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        visiblesIds.forEach((id) => next.delete(id))
        return next
      }
      return new Set([...prev, ...visiblesIds])
    })
  }
  const limpiarSeleccion = () => setSelectedIds(new Set())
  const seleccionados = useMemo(() => leads.filter((l) => selectedIds.has(l.id)), [leads, selectedIds])

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
      toast(`${lead.nombre} cualificado`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al cualificar', 'error')
    } finally {
      setScoringId(null)
    }
  }

  // Abre confirmación si el batch es grande; si no, ejecuta directamente
  const cualificarTodos = () => {
    const sinScore = leads.filter((l) => l.score_cualificacion == null)
    if (sinScore.length === 0) return
    if (sinScore.length > BATCH_CONFIRM_THRESHOLD) {
      setConfirmBatch(sinScore.length)
    } else {
      ejecutarBatch()
    }
  }

  const ejecutarBatch = async () => {
    setConfirmBatch(null)
    const sinScore = leads.filter((l) => l.score_cualificacion == null)
    if (sinScore.length === 0) return
    setBatch({ actual: 0, total: sinScore.length })
    setError('')

    try {
      // Máx 5 llamadas en paralelo, 500ms entre grupos (rate limit)
      await processBatch(
        sinScore,
        async (lead) => {
          try {
            const r = await scoreLead(lead)
            await supabase
              .from('leads_os')
              .update({
                score_cualificacion: r.score,
                motivo_score: r.motivo,
                volumen_llamadas: r.volumen,
                mrr_estimado: r.mrr,
                fase: lead.fase === 'nuevo' ? 'cualificado' : lead.fase,
              })
              .eq('id', lead.id)
          } catch {
            // continúa con el siguiente lead
          }
        },
        (done, total) => setBatch({ actual: done, total })
      )
    } catch (err) {
      // p.ej. límite diario alcanzado
      const msg = err instanceof Error ? err.message : 'Error en el batch'
      setError(msg)
      toast(msg, 'error')
    }

    setBatch(null)
    await cargar()
    toast(`${sinScore.length} leads cualificados`, 'success')
  }

  // ── Cualificar solo los seleccionados (barra de lote) ──
  const cualificarSeleccionados = async () => {
    const objetivo = seleccionados.filter((l) => l.score_cualificacion == null)
    if (objetivo.length === 0) {
      toast('Los leads seleccionados ya están cualificados', 'info')
      return
    }
    setBatch({ actual: 0, total: objetivo.length })
    setError('')
    try {
      await processBatch(
        objetivo,
        async (lead) => {
          try {
            const r = await scoreLead(lead)
            await supabase
              .from('leads_os')
              .update({
                score_cualificacion: r.score,
                motivo_score: r.motivo,
                volumen_llamadas: r.volumen,
                mrr_estimado: r.mrr,
                fase: lead.fase === 'nuevo' ? 'cualificado' : lead.fase,
              })
              .eq('id', lead.id)
          } catch {
            // continúa con el siguiente
          }
        },
        (done, total) => setBatch({ actual: done, total })
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en el batch'
      setError(msg)
      toast(msg, 'error')
    }
    setBatch(null)
    await cargar()
    toast(`${objetivo.length} leads cualificados`, 'success')
  }

  // ── Cambiar fase de los seleccionados ──
  const cambiarFaseSeleccionados = async (fase: string) => {
    setFaseDropdownOpen(false)
    setAplicandoLote(true)
    const ids = [...selectedIds]
    const { error: err } = await supabase.from('leads_os').update({ fase }).in('id', ids)
    setAplicandoLote(false)
    if (err) toast(err.message, 'error')
    else {
      await cargar()
      toast(`${ids.length} leads → ${FASE_LABELS[fase] ?? fase}`, 'success')
    }
  }

  const registrarDescartados = async (idsEliminados: string[]) => {
    const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
    const webLeads = leads.filter(
      (l) => idsEliminados.includes(l.id) && l.quiz_lead_id
    )
    if (webLeads.length === 0) return
    await supabase.from('quiz_leads_descartados').upsert(
      webLeads.map((l) => ({
        quiz_lead_id: l.quiz_lead_id,
        descartado_por: usuario,
      })),
      { onConflict: 'quiz_lead_id' }
    )
  }

  const limpiarExtracciones = async (idsEliminados: string[]) => {
    // Recoge los extraccion_id de los leads que se van a eliminar
    const extIds = [...new Set(
      leads
        .filter((l) => idsEliminados.includes(l.id) && l.extraccion_id)
        .map((l) => l.extraccion_id as string)
    )]
    if (extIds.length === 0) return
    // Para cada extraccion_id, comprueba si quedan leads después del borrado
    for (const extId of extIds) {
      // Cuenta leads de esa extracción que NO están en la lista a eliminar
      const leadsRestantes = leads.filter(
        (l) => l.extraccion_id === extId && !idsEliminados.includes(l.id)
      )
      if (leadsRestantes.length === 0) {
        await supabase.from('extracciones_os').delete().eq('extraccion_id', extId)
      }
    }
  }

  const eliminarSeleccionados = async () => {
    setConfirmEliminarLote(false)
    setEliminandoLote(true)
    const ids = [...selectedIds]
    await Promise.all([registrarDescartados(ids), limpiarExtracciones(ids)])
    const { error: err } = await supabase.from('leads_os').delete().in('id', ids)
    setEliminandoLote(false)
    if (err) toast(err.message, 'error')
    else {
      limpiarSeleccion()
      if (extraccionFiltro && !leads.some((l) => !ids.includes(l.id) && l.extraccion_id === extraccionFiltro)) {
        setExtraccionFiltro(null)
      }
      await cargar()
      toast(`${ids.length} leads eliminados`, 'info')
    }
  }

  const descartar = async (lead: Lead) => {
    await Promise.all([registrarDescartados([lead.id]), limpiarExtracciones([lead.id])])
    const { error: err } = await supabase.from('leads_os').delete().eq('id', lead.id)
    if (err) toast(err.message, 'error')
    else {
      if (extraccionFiltro && lead.extraccion_id === extraccionFiltro) {
        const quedan = leads.filter((l) => l.id !== lead.id && l.extraccion_id === extraccionFiltro)
        if (quedan.length === 0) setExtraccionFiltro(null)
      }
      await cargar()
      toast(`${lead.nombre} descartado`, 'info')
    }
    setLeadADescartar(null)
  }

  const buscarEmailLead = async (lead: Lead) => {
    setBuscandoEmail(lead.id)
    try {
      const res = await fetch('/api/find-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web: lead.web, leadId: lead.id, descripcion: lead.descripcion }),
      })
      const data = await res.json()
      if (data.email) {
        await supabase
          .from('leads_os')
          .update({ email: data.email, email_fuente: 'web_scraping', email_verificado: false })
          .eq('id', lead.id)
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, email: data.email } : l)))
        toast(`Email encontrado: ${data.email}`, 'success')
      } else {
        toast('No se encontró email en su web', 'info')
      }
    } catch {
      toast('Error buscando email', 'error')
    } finally {
      setBuscandoEmail(null)
    }
  }

  const rescorarTodos = async () => {
    setConfirmRescorar(false)
    setRescorando(true)
    setBatch({ actual: 0, total: leads.length })
    setError('')
    try {
      await processBatch(
        leads,
        async (lead) => {
          try {
            const r = await scoreLead(lead)
            await supabase
              .from('leads_os')
              .update({
                score_cualificacion: r.score,
                motivo_score: r.motivo,
                volumen_llamadas: r.volumen,
                mrr_estimado: r.mrr,
              })
              .eq('id', lead.id)
          } catch {
            // continúa con el siguiente
          }
        },
        (done, total) => setBatch({ actual: done, total })
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en el rescore'
      setError(msg)
      toast(msg, 'error')
    }
    setBatch(null)
    setRescorando(false)
    await cargar()
    toast(`${leads.length} leads rescorados con el nuevo sistema`, 'success')
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
    return (
      <PageTransition>
        <PageHeader titulo="Todos los leads" subtitulo="Cargando pipeline…" />
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)}
            </tbody>
          </table>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Todos los leads"
        subtitulo={`${filtrados.length} ${filtrados.length === 1 ? 'lead' : 'leads'} en el pipeline`}
        acciones={
          <>
            <ExportSheet leads={filtrados} />
            {!batch && !rescorando && leads.length > 0 && (
              <button className="btn-ghost" onClick={() => setConfirmRescorar(true)} style={{ fontSize: 13 }}>
                <ArrowClockwise size={15} />
                Rescorar todos
              </button>
            )}
            {sinScoreCount > 0 && !batch && (
              <button className="btn-secondary" onClick={cualificarTodos}>
                <Sparkle size={16} weight="fill" />
                Cualificar selección ({sinScoreCount})
              </button>
            )}
          </>
        }
      />

      {batch && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <LoadingBar progress={(batch.actual / batch.total) * 100} label={`Cualificando lead ${batch.actual} de ${batch.total}…`} />
        </div>
      )}

      {/* Modal de confirmación para batches grandes */}
      {confirmBatch != null && (
        <div
          onClick={() => setConfirmBatch(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 28, maxWidth: 380, width: '100%' }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Cualificar {confirmBatch} leads</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
              Vas a cualificar <strong style={{ color: 'var(--color-text-primary)' }}>{confirmBatch} leads</strong> con Claude.
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
              Coste estimado: <strong style={{ color: 'var(--color-text-primary)' }}>
                ~{estimarCoste('score', confirmBatch).toFixed(2)}€
              </strong>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmBatch(null)}>Cancelar</button>
              <button className="btn-primary" onClick={ejecutarBatch}>Confirmar y cualificar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar en lote */}
      {confirmEliminarLote && (
        <div
          onClick={() => setConfirmEliminarLote(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-eliminar-lote"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 28, maxWidth: 400, width: '100%' }}
          >
            <h2 id="titulo-eliminar-lote" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Eliminar {selectedIds.size} {selectedIds.size === 1 ? 'lead' : 'leads'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Esta acción es <strong style={{ color: 'var(--color-text-primary)' }}>permanente</strong> y no se puede deshacer.
              Se eliminarán {selectedIds.size} leads del pipeline.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmEliminarLote(false)}>Cancelar</button>
              <button className="btn-danger" onClick={eliminarSeleccionados}>
                <Trash size={16} /> Eliminar {selectedIds.size} leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para rescorar todos */}
      {confirmRescorar && (
        <div
          onClick={() => setConfirmRescorar(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 28, maxWidth: 400, width: '100%' }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Rescorar {leads.length} leads</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Vas a rescorar <strong style={{ color: 'var(--color-text-primary)' }}>{leads.length} leads</strong> con el nuevo sistema de puntuación. Los scores actuales se actualizarán.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmRescorar(false)}>Cancelar</button>
              <button className="btn-primary" onClick={rescorarTodos}>
                <ArrowClockwise size={16} /> Rescorar todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para descartar un lead */}
      {leadADescartar && (
        <div
          onClick={() => setLeadADescartar(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-descartar"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 28, maxWidth: 380, width: '100%' }}
          >
            <h2 id="titulo-descartar" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Descartar lead</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              ¿Seguro que quieres descartar <strong style={{ color: 'var(--color-text-primary)' }}>{leadADescartar.nombre}</strong>?
              Se eliminará del pipeline de forma permanente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setLeadADescartar(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => descartar(leadADescartar)}>
                <Trash size={16} /> Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--color-error)', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} /> {error}
        </p>
      )}

      {/* Banner de extracción */}
      {extraccionFiltro && (
        <div style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
            Mostrando {filtrados.length} {filtrados.length === 1 ? 'lead' : 'leads'} de la última extracción
          </span>
          <button
            className="btn-ghost"
            onClick={() => { setExtraccionFiltro(null) }}
            style={{ fontSize: 12, padding: '4px 12px', minHeight: 28, color: 'var(--color-text-secondary)' }}
          >
            <X size={12} /> Ver todos los leads
          </button>
        </div>
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
          <option value="prioridad">Prioridad recomendada</option>
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

        {/* Filtro de origen */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} role="group" aria-label="Filtrar por origen">
          {([
            { id: 'todos', label: 'Todos', icon: null, color: 'var(--color-text-secondary)' },
            { id: 'web_calculadora', label: 'Lead Web', icon: Globe, color: '#16A34A' },
            { id: 'extraccion', label: 'Extracción', icon: MagnifyingGlass, color: 'var(--color-text-secondary)' },
          ] as const).map((opt) => {
            const activo = fuenteFiltro === opt.id
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => { setFuenteFiltro(opt.id); setPagina(1) }}
                aria-pressed={activo}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 500,
                  minHeight: 'auto',
                  border: '1px solid',
                  borderColor: activo ? (opt.id === 'web_calculadora' ? 'rgba(34,197,94,0.3)' : 'var(--color-primary)') : 'var(--color-border)',
                  background: activo ? (opt.id === 'web_calculadora' ? 'rgba(34,197,94,0.08)' : 'var(--color-primary-subtle)') : 'transparent',
                  color: activo ? (opt.id === 'web_calculadora' ? '#16A34A' : 'var(--color-primary)') : 'var(--color-text-secondary)',
                  transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), border-color 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {Icon && <Icon size={12} weight={activo ? 'fill' : 'regular'} />}
                {opt.label}
              </button>
            )
          })}
        </div>

        {(soloSinPropuesta || soloInactivos) && (
          <button className="btn-ghost" onClick={limpiarFiltros} style={{ fontSize: 12, padding: '4px 10px', minHeight: 'auto' }}>
            <X size={12} /> Quitar filtro de alerta
          </button>
        )}
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
                <th style={{ padding: '0 8px 0 16px', height: 36, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={handleSelectAll}
                    aria-label="Seleccionar todos los leads"
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer', minHeight: 'auto' }}
                  />
                </th>
                {[
                  { label: 'Score' },
                  { label: 'Nombre' },
                  { label: 'Sector' },
                  { label: 'Teléfono' },
                  { label: 'Email', cls: 'hide-mobile' },
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
              {visibles.map((lead) => {
                const selected = selectedIds.has(lead.id)
                return (
                <tr
                  key={lead.id}
                  className="lead-row"
                  style={{
                    height: 56,
                    borderBottom: '1px solid var(--color-border)',
                    borderLeft: selected ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: selected ? 'var(--color-primary-subtle)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onClick={() => setQuickViewLead(lead)}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '0 8px 0 16px' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(lead.id)}
                      aria-label={`Seleccionar ${lead.nombre}`}
                      className="lead-checkbox"
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: 'var(--color-primary)',
                        cursor: 'pointer',
                        minHeight: 'auto',
                        opacity: selected || selectedIds.size > 0 ? 1 : undefined,
                      }}
                    />
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <ScoreBadge score={lead.score_cualificacion} size="sm" />
                      {lead.score_cualificacion != null && (
                        <div style={{ width: 44, height: 3, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${lead.score_cualificacion * 10}%`,
                              height: '100%',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--gradient-brand)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '8px 16px', maxWidth: 240 }}>
                    <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{lead.nombre}</div>
                    {lead.ciudad && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{lead.ciudad}</div>
                    )}
                    {lead.fuente === 'web_calculadora' && (
                      <div style={{ marginTop: 3 }}><FuenteBadge fuente={lead.fuente} /></div>
                    )}
                    <UrgenciaPills lead={lead} />
                  </td>
                  <td style={{ padding: '0 16px', color: 'var(--color-text-secondary)' }}>{lead.sector}</td>
                  <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>{lead.telefono ?? '—'}</td>
                  <td className="hide-mobile" style={{ padding: '0 16px' }} onClick={(e) => e.stopPropagation()}>
                    {lead.email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{lead.email}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(lead.email!); toast('Email copiado', 'info') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-tertiary)' }}
                          title="Copiar email"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : lead.web ? (
                      <button
                        onClick={() => buscarEmailLead(lead)}
                        className="btn-ghost"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          minHeight: 'auto',
                          color: 'var(--color-primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        disabled={buscandoEmail === lead.id}
                      >
                        {buscandoEmail === lead.id ? (
                          <><div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Buscando...</>
                        ) : (
                          <><MagnifyingGlass size={11} /> Buscar</>
                        )}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin web</span>
                    )}
                  </td>
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
                      <button aria-label={`Vista rápida de ${lead.nombre}`} title="Vista rápida" className="btn-ghost" style={{ padding: 8, minHeight: 36, minWidth: 36 }} onClick={() => setQuickViewLead(lead)}>
                        <Eye size={16} />
                      </button>
                      <button
                        aria-label={`Cualificar ${lead.nombre} con IA`}
                        title="Cualificar"
                        className={`btn-ghost acciones-extra${menuFilaId === lead.id ? ' show' : ''}`}
                        style={{ padding: 8, minHeight: 36, minWidth: 36 }}
                        disabled={scoringId === lead.id || !!batch}
                        onClick={() => cualificar(lead)}
                      >
                        {scoringId === lead.id ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Lightning size={16} />}
                      </button>
                      <button
                        aria-label={`Descartar ${lead.nombre}`}
                        title="Descartar"
                        className={`btn-ghost acciones-extra${menuFilaId === lead.id ? ' show' : ''}`}
                        style={{ padding: 8, minHeight: 36, minWidth: 36, color: 'var(--color-error)' }}
                        onClick={() => setLeadADescartar(lead)}
                      >
                        <X size={16} />
                      </button>
                      <button
                        aria-label={`Más acciones para ${lead.nombre}`}
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
                )
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 0 }}>
                    {hayFiltros ? (
                      <EmptyState
                        icon={MagnifyingGlass}
                        titulo="No hay leads con estos filtros"
                        descripcion="Prueba a ampliar la búsqueda o limpia los filtros activos."
                        accion={{ label: 'Limpiar filtros', onClick: limpiarFiltros }}
                        compacto
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        titulo="Aún no hay leads"
                        descripcion="Extrae negocios locales de Google Maps para empezar."
                        accion={{ label: 'Extraer leads →', onClick: () => navigate('/extraer') }}
                        compacto
                      />
                    )}
                  </td>
                </tr>
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

      {/* ── Barra de acciones en lote ── */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: '#09090B',
            borderRadius: 14,
            padding: '12px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            animation: 'lote-bar-in 200ms cubic-bezier(0.16,1,0.3,1)',
          }}
          role="region"
          aria-label="Acciones en lote"
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
            {selectedIds.size} {selectedIds.size === 1 ? 'lead seleccionado' : 'leads seleccionados'}
          </span>
          <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />

          <button className="lote-bar-btn" onClick={cualificarSeleccionados} disabled={!!batch} style={loteBtnStyle}>
            <Sparkle size={16} weight="fill" /> Cualificar con IA
          </button>

          <ExportSheet leads={seleccionados} variant="dark" />

          {/* Cambiar fase */}
          <div style={{ position: 'relative' }}>
            <button className="lote-bar-btn" onClick={() => setFaseDropdownOpen((v) => !v)} disabled={aplicandoLote} style={loteBtnStyle}>
              <ArrowRight size={16} /> {aplicandoLote ? 'Aplicando…' : 'Cambiar fase'}
            </button>
            {faseDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0,
                  background: '#18181B',
                  borderRadius: 'var(--radius-md)',
                  padding: 6,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
                  minWidth: 180,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {FASES.map((f) => (
                  <button
                    key={f}
                    onClick={() => cambiarFaseSeleccionados(f)}
                    style={{
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.85)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: 'left',
                      minHeight: 36,
                      transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {FASE_LABELS[f]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="lote-bar-btn"
            onClick={() => setConfirmEliminarLote(true)}
            disabled={eliminandoLote}
            style={{ ...loteBtnStyle, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}
          >
            <Trash size={16} /> {eliminandoLote ? 'Eliminando…' : 'Eliminar'}
          </button>

          <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
          <button
            onClick={limpiarSeleccion}
            aria-label="Cancelar selección"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Vista rápida (panel lateral) ── */}
      <QuickView lead={quickViewLead} onClose={() => setQuickViewLead(null)} onUpdated={cargar} />
    </PageTransition>
  )
}

// Orden de prioridad: 0 = caliente sin trabajar, 1 = demo sin propuesta, 2 = resto.
function prioridad(l: Lead): number {
  if (esCalienteSinTrabajar(l)) return 0
  if (esDemoSinPropuesta(l)) return 1
  return 2
}

// Pills de urgencia bajo el nombre — solo se muestran las relevantes.
function UrgenciaPills({ lead }: { lead: Lead }) {
  const pills: { texto: string; bg: string; color: string; title?: string }[] = []
  // Lead web con pérdida real → la mostramos siempre, en rojo (su dato más potente)
  if (lead.fuente === 'web_calculadora' && lead.perdida_mensual_real != null && lead.perdida_mensual_real > 0) {
    pills.push({
      texto: `· −${lead.perdida_mensual_real.toLocaleString('es-ES')}€/mes`,
      bg: 'rgba(239,68,68,0.08)',
      color: '#EF4444',
      title: 'Pérdida real calculada por el cliente',
    })
  }
  if (esCalienteSinTrabajar(lead)) {
    pills.push({ texto: '· Caliente sin trabajar', bg: 'rgba(239,68,68,0.08)', color: '#EF4444' })
  }
  if (esDemoSinPropuesta(lead)) {
    pills.push({ texto: '· Demo sin propuesta', bg: 'rgba(245,158,11,0.08)', color: '#F59E0B' })
  }
  if (esInactivo(lead)) {
    pills.push({ texto: '· Sin actividad 7d+', bg: 'rgba(161,161,170,0.1)', color: 'var(--color-text-tertiary)' })
  }
  if (lead.agent_id_retell) {
    pills.push({ texto: '· Demo activa', bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)' })
  }
  if (pills.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {pills.map((p) => (
        <span
          key={p.texto}
          title={p.title}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
            fontSize: 10,
            fontWeight: 500,
            background: p.bg,
            color: p.color,
            whiteSpace: 'nowrap',
          }}
        >
          {p.texto}
        </span>
      ))}
    </div>
  )
}

const loteBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '0 14px',
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
}
