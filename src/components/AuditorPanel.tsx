import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ShieldCheck, WarningCircle, CheckCircle, ClockCounterClockwise, ArrowCounterClockwise } from '@phosphor-icons/react'
import Skeleton from './Skeleton'
import { resetCircuitBreaker } from '../lib/apiAuditor'
import { useToast } from './Toast'

interface AuditLog {
  id: string
  servicio: string
  endpoint: string
  error_msg: string
  status_code: number | null
  creado_en: string
}

export default function AuditorPanel() {
  const toast = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [cargando, setCargando] = useState(true)
  const [servicios, setServicios] = useState<{ nombre: string; estado: 'ok' | 'error' }[]>([
    { nombre: 'Claude', estado: 'ok' },
    { nombre: 'Gemini', estado: 'ok' },
    { nombre: 'ElevenLabs', estado: 'ok' },
    { nombre: 'Apify', estado: 'ok' },
    { nombre: 'Hunter', estado: 'ok' },
  ])

  const resetear = async () => {
    try {
      // 1. Reset in-memory circuit breaker
      resetCircuitBreaker()
      
      // 2. Delete logs from database
      const { error } = await supabase
        .from('api_audit_logs')
        .delete()
        .neq('id', '0') // Deletes all rows
        
      if (error) throw error
      
      // 3. Reset UI state
      setServicios(prev => prev.map(s => ({ ...s, estado: 'ok' })))
      setLogs([])
      
      toast('Auditor de APIs reseteado con éxito', 'success')
    } catch (err: any) {
      toast(`Error al resetear: ${err.message}`, 'error')
    }
  }

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('api_audit_logs')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(20)

    if (data) {
      setLogs(data)
      
      // Marcar servicios con errores en las últimas 24h
      const ayer = new Date(Date.now() - 86400000).toISOString()
      const recientes = data.filter(d => d.creado_en > ayer)
      
      setServicios(prev => prev.map(s => ({
        ...s,
        estado: recientes.some(r => r.servicio === s.nombre) ? 'error' : 'ok'
      })))
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()

    const sub = supabase
      .channel('auditor_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'api_audit_logs' }, (payload) => {
        const nuevo = payload.new as AuditLog
        setLogs(prev => [nuevo, ...prev].slice(0, 20))
        setServicios(prev => prev.map(s => s.nombre === nuevo.servicio ? { ...s, estado: 'error' } : s))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [])

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-card)',
        backdropFilter: 'blur(12px)',
        padding: 32,
        marginBottom: 32,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={20} weight="fill" style={{ color: 'var(--color-primary)' }} />
          Agente Auditor de APIs
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            className="btn-secondary" 
            onClick={resetear} 
            style={{ fontSize: 12, padding: '6px 12px', minHeight: 'auto', gap: 6, display: 'inline-flex', alignItems: 'center' }}
            title="Resetear Circuit Breaker y limpiar historial de fallos"
          >
            <ArrowCounterClockwise size={14} />
            Restablecer APIs
          </button>
          <button className="btn-ghost" onClick={cargar} style={{ padding: '6px' }} title="Recargar logs">
            <ClockCounterClockwise size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {servicios.map(s => (
          <div
            key={s.nombre}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-2)',
              border: `1px solid ${s.estado === 'ok' ? 'transparent' : 'var(--color-error)'}`
            }}
          >
            {s.estado === 'ok' 
              ? <CheckCircle size={16} weight="fill" style={{ color: 'var(--color-success)' }} />
              : <WarningCircle size={16} weight="fill" style={{ color: 'var(--color-error)' }} />
            }
            {s.nombre}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 12, letterSpacing: '0.06em' }}>
        Últimos Fallos Interceptados
      </p>

      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton.Line height={40} />
          <Skeleton.Line height={40} />
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            No hay caídas registradas. Todas las APIs responden correctamente.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              <WarningCircle size={18} weight="fill" style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Fallo en {log.servicio} {log.status_code ? `(${log.status_code})` : ''}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace', lineHeight: 1.4 }}>
                  {log.error_msg}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                  {new Date(log.creado_en).toLocaleString('es-ES')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
