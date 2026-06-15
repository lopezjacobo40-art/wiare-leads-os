import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { FASES, FASE_LABELS } from '../lib/supabaseClient'

/* Colores semánticos por fase (compartidos con el Kanban). */
export const FASE_COLOR: Record<string, string> = {
  nuevo: '#A1A1AA',
  cualificado: '#F59E0B',
  demo_creada: '#6366F1',
  propuesta_creada: '#8B5CF6',
  propuesta_enviada: '#A855F7',
  cerrado: '#22C55E',
}

interface Props {
  fase: string
  onChange: (fase: string) => void
}

/* Dropdown custom para cambiar la fase de un lead. Reemplaza el <select> nativo. */
export default function FaseSelector({ fase, onChange }: Props) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const color = FASE_COLOR[fase] ?? 'var(--color-text-secondary)'

  // Cierra al hacer click fuera o pulsar Escape
  useEffect(() => {
    if (!abierto) return
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onEsc)
    }
  }, [abierto])

  const seleccionar = (f: string) => {
    setAbierto(false)
    if (f !== fase) onChange(f)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        style={{ minHeight: 36, padding: '0 12px', fontWeight: 500, gap: 8 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {FASE_LABELS[fase] ?? fase}
        <CaretDown size={14} style={{ transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1)', transform: abierto ? 'rotate(180deg)' : 'none' }} />
      </button>

      {abierto && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 200,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 6,
            zIndex: 30,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {FASES.map((f) => {
            const activo = f === fase
            const c = FASE_COLOR[f]
            return (
              <button
                key={f}
                role="option"
                aria-selected={activo}
                onClick={() => seleccionar(f)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  minHeight: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: activo ? 'var(--color-surface-2)' : 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                  transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => { if (!activo) e.currentTarget.style.background = 'var(--color-surface)' }}
                onMouseLeave={(e) => { if (!activo) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{FASE_LABELS[f]}</span>
                {activo && <Check size={14} weight="bold" style={{ color: c }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
