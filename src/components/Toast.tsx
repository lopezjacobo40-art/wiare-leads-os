import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle, XCircle, Info, X } from '@phosphor-icons/react'

/* ─────────────────────────────────────────────
   Sistema de notificaciones global (Toasts)
   - Posición: top-right, z-index 9999
   - Auto-dismiss: 3s
   - Tipos: success / error / info
   - Animación: slide-in derecha, fade-out al cerrar (≤300ms)
   - Máximo 3 simultáneos (se descarta el más antiguo)
   ───────────────────────────────────────────── */

export type ToastTipo = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tipo: ToastTipo
  mensaje: string
  saliendo: boolean
}

interface ToastContextValue {
  toast: (mensaje: string, tipo?: ToastTipo) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3
const DURACION = 3000
const ANIM_SALIDA = 250 // ms — debe coincidir con la animación CSS

const CONFIG: Record<ToastTipo, { color: string; bg: string; Icon: typeof CheckCircle }> = {
  success: { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)', Icon: CheckCircle },
  error: { color: 'var(--color-error)', bg: 'rgba(239,68,68,0.10)', Icon: XCircle },
  info: { color: 'var(--color-primary)', bg: 'var(--color-primary-subtle)', Icon: Info },
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    // Marca como saliente para reproducir la animación, luego elimina
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, ANIM_SALIDA)
  }, [])

  const toast = useCallback(
    (mensaje: string, tipo: ToastTipo = 'info') => {
      const id = nextId++
      setToasts((prev) => {
        const siguiente = [...prev, { id, tipo, mensaje, saliendo: false }]
        // Limita a MAX_TOASTS descartando los más antiguos
        return siguiente.slice(-MAX_TOASTS)
      })
      setTimeout(() => dismiss(id), DURACION)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {toasts.map((t) => {
        const { color, bg, Icon } = CONFIG[t.tipo]
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 260,
              maxWidth: 360,
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderTop: `2px solid ${color}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              animation: t.saliendo
                ? 'toast-out 250ms cubic-bezier(0.4,0,0.2,1) forwards'
                : 'toast-slide-in 250ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-sm)',
                background: bg,
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={16} weight="fill" />
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                lineHeight: 1.4,
                flex: 1,
              }}
            >
              {t.mensaje}
            </span>
            <button
              aria-label="Cerrar"
              onClick={() => onDismiss(t.id)}
              className="btn-ghost"
              style={{ padding: 4, minHeight: 'auto', flexShrink: 0, color: 'var(--color-text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* Hook de consumo. Devuelve siempre una función válida aunque falte el provider. */
export function useToast(): (mensaje: string, tipo?: ToastTipo) => void {
  const ctx = useContext(ToastContext)
  // Fallback defensivo: si por error se usa fuera del provider, no rompe la app.
  const fallback = useCallback((mensaje: string) => {
    if (typeof window !== 'undefined') console.warn('[toast sin provider]', mensaje)
  }, [])
  useEffect(() => {
    if (!ctx) console.warn('useToast usado fuera de <ToastProvider>')
  }, [ctx])
  return ctx?.toast ?? fallback
}
