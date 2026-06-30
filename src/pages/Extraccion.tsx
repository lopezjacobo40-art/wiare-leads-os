import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ForkKnife, FirstAid, GraduationCap, Buildings, Wrench,
  Scissors, Bed, Barbell, Pill, Storefront, CheckCircle, Warning, X,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { extraerLeadsConApify, extraerLeadsConApifyAsync, type ApifyLead } from '../lib/apifyClient'
import { processBatch } from '../lib/tokenGuard'
import LoadingBar from '../components/LoadingBar'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'

// Palabras que sugieren cadena nacional/franquicia
const PALABRAS_CADENA = [
  'mcdonald', 'burger king', 'kfc', 'telepizza', 'domino', 'dunkin',
  'mercadona', 'lidl', 'aldi', 'carrefour', 'el corte inglés',
  'zara', 'h&m', 'mango', 'primark', 'decathlon',
  'clínica baviera', 'multiópticas', 'specsavers',
  'clínica dental orión', 'vitaldent', 'dentix', 'isocel', 'propdental',
  'planet fitness', 'anytime fitness',
]

function esCadena(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return PALABRAS_CADENA.some((c) => n.includes(c))
}

// Heurística "empresa grande / +50 trabajadores". Apify no da nº de empleados
// fiable, así que se usa un proxy. OJO: muchas reseñas NO implica empresa grande
// — una clínica dental top de Madrid supera 1500 reseñas y es ICP perfecto.
// Por eso el umbral es alto (solo grandes superficies/franquicias lo superan) y
// la exclusión dura se reserva a cadenas conocidas; el volumen de reseñas solo
// se usa para des-priorizar (ver `ordenarPorEncaje`), no para excluir en duro.
const RESENAS_GRAN_SUPERFICIE = 3000
function esCadena_o_GranSuperficie(l: ApifyLead): boolean {
  if (esCadena(l.title)) return true
  if ((l.reviewsCount ?? 0) > RESENAS_GRAN_SUPERFICIE) return true
  return false
}

const SECTORES = [
  { nombre: 'Restaurante', icon: ForkKnife },
  { nombre: 'Clínica', icon: FirstAid },
  { nombre: 'Academia', icon: GraduationCap },
  { nombre: 'Inmobiliaria', icon: Buildings },
  { nombre: 'Taller', icon: Wrench },
  { nombre: 'Peluquería', icon: Scissors },
  { nombre: 'Hotel', icon: Bed },
  { nombre: 'Gimnasio', icon: Barbell },
  { nombre: 'Farmacia', icon: Pill },
  { nombre: 'Otro', icon: Storefront },
]

type Estado = 'idle' | 'buscando' | 'extrayendo' | 'enriqueciendo' | 'completado' | 'completado_async' | 'error'

export default function Extraccion() {
  const navigate = useNavigate()
  const [sector, setSector] = useState('')
  const [otroSector, setOtroSector] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [cantidad, setCantidad] = useState(30)
  const [estado, setEstado] = useState<Estado>('idle')
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 })
  const [log, setLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [guardados, setGuardados] = useState(0)
  const [duplicados, setDuplicados] = useState(0)
  const [filtradosCadena, setFiltradosCadena] = useState(0)
  const [emailsEnriquecidos, setEmailsEnriquecidos] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  // Filtros de extracción avanzados
  const [cpZona, setCpZona] = useState('')
  const [excluirCadenas, setExcluirCadenas] = useState(false)
  const [soloConQuejas, setSoloConQuejas] = useState(false)
  const [excluirGrandes, setExcluirGrandes] = useState(true) // regla dura: nada de +50 trabajadores

  // Pills de filtros activos
  const filtrosActivos = [
    cpZona.trim() ? { key: 'cp', label: `Zona: "${cpZona.trim()}"`, clear: () => setCpZona('') } : null,
    excluirGrandes ? { key: 'grandes', label: 'Sin empresas grandes', clear: () => setExcluirGrandes(false) } : null,
    excluirCadenas ? { key: 'cadenas', label: 'Sin cadenas', clear: () => setExcluirCadenas(false) } : null,
    soloConQuejas ? { key: 'quejas', label: 'Solo con quejas', clear: () => setSoloConQuejas(false) } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const sectorFinal = sector === 'Otro' ? otroSector.trim() : sector
  const puedeExtraer = sectorFinal && ciudad.trim() && estado !== 'buscando' && estado !== 'extrayendo' && estado !== 'enriqueciendo'

  const [extraccionId, setExtraccionId] = useState('')

  const extraer = async () => {
    const sessionId = crypto.randomUUID()
    setExtraccionId(sessionId)
    setEstado('buscando')
    setLog([])
    setErrorMsg('')
    setProgreso({ actual: 0, total: cantidad })
    setFiltradosCadena(0)
    setEmailsEnriquecidos(0)
    try {
      const { runId, modo } = await extraerLeadsConApifyAsync(sectorFinal, ciudad.trim(), cantidad)
      
      // Registrar la extracción inmediatamente
      await supabase.from('extracciones_os').insert({
        sector: sectorFinal,
        ciudad: ciudad.trim(),
        total_leads: 0, // se actualizará cuando termine
        estado: 'procesando',
        extraccion_id: sessionId,
        run_id: runId
      })

      if (modo === 'async') {
        setEstado('completado_async')
        return
      }

      // Fallback a modo síncrono para test local
      const leadsRaw = await extraerLeadsConApify(sectorFinal, ciudad.trim(), cantidad, (mensaje) => {
        setEstado('extrayendo')
        setLog((prev) => [...prev, mensaje])
      }, runId)

      setProgreso({ actual: leadsRaw.length, total: leadsRaw.length })

      // ── Filtros post-extracción ──
      let leads: ApifyLead[] = leadsRaw
      let numCadenasExcluidas = 0
      // Excluir empresas grandes: solo cadenas conocidas y grandes superficies
      // (>3000 reseñas). Umbral alto a propósito para no descartar negocios ICP
      // muy reseñados (p.ej. una clínica dental top con 1500-2500 reseñas).
      if (excluirGrandes) {
        const antes = leads.length
        leads = leads.filter((l) => !esCadena_o_GranSuperficie(l))
        numCadenasExcluidas += antes - leads.length
      }
      if (excluirCadenas) {
        const antes = leads.length
        leads = leads.filter((l) => !esCadena(l.title))
        numCadenasExcluidas += antes - leads.length
      }
      setFiltradosCadena(numCadenasExcluidas)
      if (cpZona.trim()) {
        const zona = cpZona.trim().toLowerCase()
        leads = leads.filter((l) => (l.address ?? '').toLowerCase().includes(zona))
      }
      if (soloConQuejas) {
        leads = leads.filter((l) => l.rating != null && l.rating <= 3.5)
      }

      if (leads.length === 0) throw new Error('No se encontraron resultados para esa búsqueda')

      // ── Detección de duplicados ──
      const placeIds = leads.map((l) => l.placeId).filter(Boolean)
      const { data: existentes, error: dupError } = await supabase
        .from('leads_os')
        .select('google_place_id')
        .in('google_place_id', placeIds)
      if (dupError) throw dupError

      const yaExisten = new Set((existentes ?? []).map((e) => e.google_place_id))
      const nuevos = leads.filter((l) => !yaExisten.has(l.placeId))
      const numDuplicados = leads.length - nuevos.length

      const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
      let insertados: { id: string; email: string | null; web: string | null; descripcion: string | null; nombre: string }[] = []
      if (nuevos.length > 0) {
        const { data: insData, error: insError } = await supabase
          .from('leads_os')
          .insert(nuevos.map((l) => ({
            nombre: l.title,
            sector: sectorFinal,
            telefono: l.phone,
            email: l.email,
            email_fuente: l.email ? 'apify_maps' : null,
            email_verificado: false,
            web: l.website,
            google_maps_url: l.url,
            google_place_id: l.placeId,
            valoracion: l.rating,
            num_resenas: l.reviewsCount,
            direccion: l.address,
            ciudad: ciudad.trim(),
            horario: l.openingHours,
            descripcion: l.description,
            fuente: 'extraccion',
            fase: 'nuevo',
            creado_por: usuario,
            extraccion_id: sessionId,
            extraccion_fecha: new Date().toISOString(),
          })))
          .select('id, email, web, descripcion, nombre')
        if (insError) throw insError
        insertados = (insData ?? []) as typeof insertados
      }

      await supabase.from('extracciones_os').update({
        total_leads: nuevos.length,
        estado: 'completada',
      }).eq('run_id', runId)

      setGuardados(nuevos.length)
      setDuplicados(numDuplicados)
      setEstado('completado')

      // ── Cascada de email en background: rellena el email de los que no lo traen ──
      const sinEmail = insertados.filter((l) => !l.email && l.web)
      if (sinEmail.length > 0) {
        setEstado('enriqueciendo')
        setProgreso({ actual: 0, total: sinEmail.length })
        setLog((prev) => [...prev, `Buscando email de ${sinEmail.length} negocios sin email…`])
        let encontrados = 0
        let hechos = 0
        await processBatch(
          sinEmail,
          async (l) => {
            let email: string | null = null
            let fuente = 'sin_email'
            let decisor: any = null
            try {
              const res = await fetch('/api/find-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ web: l.web, descripcion: l.descripcion, nombre: l.nombre }),
              })
              if (res.ok) {
                const data = await res.json()
                email = data.email ?? null
                fuente = data.fuente ?? 'sin_email'
                decisor = data.decisor ?? null
              }
            } catch {
              // red error — dejamos email null
            }
            hechos++
            setProgreso({ actual: hechos, total: sinEmail.length })
            
            // Siempre actualizamos si encontramos algo (email o decisor)
            if (email || decisor) {
              if (email) encontrados++
              setEmailsEnriquecidos(encontrados)
              await supabase
                .from('leads_os')
                .update({ 
                  email, 
                  email_fuente: fuente, 
                  email_verificado: !!email,
                  decisor_nombre: decisor?.nombre || null,
                  decisor_cargo: decisor?.cargo || null,
                  decisor_linkedin: decisor?.linkedin || null
                })
                .eq('id', l.id)
                
              if (email && decisor) {
                setLog((prev) => [...prev, `${email} (CEO: ${decisor.nombre})`])
              } else if (email) {
                setLog((prev) => [...prev, `${email} (${fuente})`])
              } else if (decisor) {
                setLog((prev) => [...prev, `CEO encontrado: ${decisor.nombre} (Sin email)`])
              }
            } else {
              setLog((prev) => [...prev, `— sin info extra`])
            }
          },
          (done) => setProgreso({ actual: done, total: sinEmail.length })
        )
        setLog((prev) => [...prev, `${encontrados} de ${sinEmail.length} emails encontrados`])
      }
      setEstado('completado')
    } catch (err: any) {
      console.error('Error en extracción:', err)
      setErrorMsg(err?.message || (typeof err === 'string' ? err : 'Error desconocido'))
      setEstado('error')
    }
  }

  return (
    <PageTransition>
      <PageHeader titulo="Extraer leads" subtitulo="Busca negocios locales en Google Maps y guárdalos en el pipeline" />
      <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 12 }}>Sector</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {SECTORES.map(({ nombre, icon: Icon }) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setSector(nombre)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  border: sector === nombre ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: sector === nombre ? 'rgba(99,102,241,0.08)' : '#fff',
                  color: sector === nombre ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
              >
                <Icon size={18} weight="duotone" />
                {nombre}
              </button>
            ))}
          </div>
          {sector === 'Otro' && (
            <input
              placeholder="Escribe el sector…"
              value={otroSector}
              onChange={(e) => setOtroSector(e.target.value)}
              style={{ marginTop: 12, width: '100%' }}
            />
          )}
        </div>

        <div>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Ciudad</label>
          <input
            placeholder="Ej: Valencia"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Cantidad: <span style={{ color: 'var(--accent-primary)' }}>{cantidad}</span>
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-primary)', minHeight: 44 }}
          />
        </div>

        {/* ── Filtros avanzados ── */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 0 }}>
            Filtros de extracción
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 8 }}>— se aplican sobre los resultados</span>
          </label>

          {/* CP / zona */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Código postal o zona dentro de la ciudad
            </label>
            <input
              placeholder="Ej: 46010, Eixample, Centro…"
              value={cpZona}
              onChange={(e) => setCpZona(e.target.value)}
              style={{ width: '100%', maxWidth: 280 }}
            />
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }} title="Excluye cadenas conocidas y grandes superficies (>3000 reseñas). No descarta negocios ICP muy reseñados.">
              <input
                type="checkbox"
                checked={excluirGrandes}
                onChange={(e) => setExcluirGrandes(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', minHeight: 'auto' }}
              />
              <span>Excluir cadenas y empresas grandes</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={excluirCadenas}
                onChange={(e) => setExcluirCadenas(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', minHeight: 'auto' }}
              />
              <span>Excluir cadenas nacionales</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={soloConQuejas}
                onChange={(e) => setSoloConQuejas(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', minHeight: 'auto' }}
              />
              <span>Solo negocios con valoración ≤ 3.5 ★</span>
            </label>
          </div>

          {/* Pills de filtros activos */}
          {filtrosActivos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filtrosActivos.map((f) => (
                <span
                  key={f.key}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 500,
                    background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  {f.label}
                  <button
                    onClick={f.clear}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit', minHeight: 'auto' }}
                    aria-label={`Quitar filtro ${f.label}`}
                  >
                    <X size={11} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button className="btn-gradient" disabled={!puedeExtraer} onClick={extraer}>
          Extraer leads →
        </button>
      </div>

      {estado === 'buscando' && (
        <div className="card" style={{ padding: 24, marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="spinner" />
          <p style={{ fontSize: 14 }}>Buscando {sectorFinal} en {ciudad}…</p>
        </div>
      )}

      {estado === 'extrayendo' && (
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <LoadingBar
            progress={(progreso.actual / progreso.total) * 100}
            label={`Extrayendo lead ${progreso.actual} de ${progreso.total}…`}
          />
          <div
            ref={logRef}
            style={{
              marginTop: 16,
              maxHeight: 200,
              overflowY: 'auto',
              fontSize: 13,
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {log.map((line, i) => <span key={i}>{line}</span>)}
          </div>
        </div>
      )}

      {estado === 'enriqueciendo' && (
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <LoadingBar
            progress={progreso.total ? (progreso.actual / progreso.total) * 100 : 0}
            label={`Buscando email ${progreso.actual} de ${progreso.total}…`}
          />
          <div
            ref={logRef}
            style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {log.map((line, i) => <span key={i}>{line}</span>)}
          </div>
        </div>
      )}

      {estado === 'completado' && (
        <div className="card" style={{ padding: 24, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={22} weight="fill" style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>
                {guardados} {guardados === 1 ? 'lead nuevo' : 'leads nuevos'}
                {emailsEnriquecidos > 0 && ` · ${emailsEnriquecidos} con email encontrado`}
              </p>
              {(duplicados > 0 || filtradosCadena > 0) && (
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {duplicados > 0 && `${duplicados} ${duplicados === 1 ? 'duplicado omitido' : 'duplicados omitidos'}`}
                  {duplicados > 0 && filtradosCadena > 0 && ' · '}
                  {filtradosCadena > 0 && `${filtradosCadena} ${filtradosCadena === 1 ? 'grande/cadena excluida' : 'grandes/cadenas excluidas'}`}
                </p>
              )}
            </div>
          </div>
          <button className="btn-gradient" onClick={() => navigate(`/leads?extraccion=${extraccionId}`)}>
            Ver leads extraídos →
          </button>
        </div>
      )}

      {estado === 'completado_async' && (
        <div className="card" style={{ padding: 24, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner" style={{ borderColor: 'var(--color-primary) transparent var(--color-primary) transparent' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>
                Extracción en curso...
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Apify está buscando los negocios. Puedes cerrar esta pestaña; los leads aparecerán en el Dashboard cuando termine (1-2 minutos).
              </p>
            </div>
          </div>
          <button className="btn-gradient" onClick={() => navigate('/')}>
            Ir al Dashboard →
          </button>
        </div>
      )}

      {estado === 'error' && (
        <div className="card" style={{ padding: 24, marginTop: 20, borderColor: 'rgba(239,68,68,0.3)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warning size={18} weight="fill" style={{ flexShrink: 0 }} /> {errorMsg}
          </p>
        </div>
      )}
      </div>
    </PageTransition>
  )
}
