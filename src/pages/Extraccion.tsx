import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ForkKnife, FirstAid, GraduationCap, Buildings, Wrench,
  Scissors, Bed, Barbell, Pill, Storefront, CheckCircle, Warning,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { extraerLeads } from '../lib/googlePlaces'
import LoadingBar from '../components/LoadingBar'
import PageHeader from '../components/PageHeader'
import PageTransition from '../components/PageTransition'

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

type Estado = 'idle' | 'buscando' | 'extrayendo' | 'completado' | 'error'

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
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const sectorFinal = sector === 'Otro' ? otroSector.trim() : sector
  const puedeExtraer = sectorFinal && ciudad.trim() && estado !== 'buscando' && estado !== 'extrayendo'

  const extraer = async () => {
    setEstado('buscando')
    setLog([])
    setErrorMsg('')
    setProgreso({ actual: 0, total: cantidad })
    try {
      const leads = await extraerLeads(sectorFinal, ciudad.trim(), cantidad, (lead, i, total) => {
        setEstado('extrayendo')
        setProgreso({ actual: i, total })
        setLog((prev) => [
          ...prev,
          `${lead.nombre}  ·  ${lead.valoracion ?? '–'} ★  ·  ${lead.num_resenas ?? 0} reseñas`,
        ])
      })

      if (leads.length === 0) throw new Error('No se encontraron resultados para esa búsqueda')

      // ── Detección de duplicados ──
      // Consultamos qué google_place_id de los extraídos ya existen en el pipeline.
      const placeIds = leads.map((l) => l.google_place_id).filter(Boolean)
      const { data: existentes, error: dupError } = await supabase
        .from('leads_os')
        .select('google_place_id')
        .in('google_place_id', placeIds)
      if (dupError) throw dupError

      const yaExisten = new Set((existentes ?? []).map((e) => e.google_place_id))
      const nuevos = leads.filter((l) => !yaExisten.has(l.google_place_id))
      const numDuplicados = leads.length - nuevos.length

      const usuario = sessionStorage.getItem('wiare_user') ?? 'desconocido'
      if (nuevos.length > 0) {
        const { error: insError } = await supabase
          .from('leads_os')
          .insert(nuevos.map((l) => ({ ...l, creado_por: usuario })))
        if (insError) throw insError
      }

      await supabase.from('extracciones_os').insert({
        sector: sectorFinal,
        ciudad: ciudad.trim(),
        total_leads: nuevos.length,
        estado: 'completada',
      })

      setGuardados(nuevos.length)
      setDuplicados(numDuplicados)
      setEstado('completado')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
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

      {estado === 'completado' && (
        <div className="card" style={{ padding: 24, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={22} weight="fill" style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>
              {guardados} {guardados === 1 ? 'lead nuevo' : 'leads nuevos'}
              {duplicados > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  {' · '}{duplicados} {duplicados === 1 ? 'duplicado omitido' : 'duplicados omitidos'}
                </span>
              )}
            </p>
          </div>
          <button className="btn-gradient" onClick={() => navigate('/leads')}>
            Ver leads →
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
