import { useState } from 'react'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import type { Lead } from '../lib/supabaseClient'
import { exportarASheets } from '../lib/googleSheets'

type Estado = 'idle' | 'loading' | 'success' | 'error'

// Logo oficial de Google Sheets (evita el GoogleLogo de Phosphor, que se ve raro).
function SheetsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#0F9D58"
        d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"
      />
    </svg>
  )
}

/* Botón de exportación a Google Sheets con modal de confirmación.
   Exporta exactamente los leads recibidos.
   `variant="dark"` lo adapta a la barra de acciones en lote (fondo negro). */
export default function ExportSheet({
  leads,
  variant = 'light',
  onDone,
}: {
  leads: Lead[]
  variant?: 'light' | 'dark'
  onDone?: () => void
}) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [confirmar, setConfirmar] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const exportar = async () => {
    setConfirmar(false)
    setEstado('loading')
    setErrorMsg('')
    try {
      const url = await exportarASheets(leads)
      setSheetUrl(url)
      setEstado('success')
      onDone?.()
      // Vuelve a idle tras 3s para permitir re-exportar.
      window.setTimeout(() => setEstado('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al exportar')
      setEstado('error')
    }
  }

  const dark = variant === 'dark'

  // Estilo del botón base — claro (header) vs oscuro (barra lote).
  const botonStyle: React.CSSProperties = dark
    ? {
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
        transition: 'background 200ms cubic-bezier(0.4,0,0.2,1)',
      }
    : {
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '0 16px',
        height: 36,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1), transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }

  return (
    <>
      {/* Botón / estado */}
      {estado === 'success' ? (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noreferrer"
          style={{ ...botonStyle, textDecoration: 'none' }}
        >
          <CheckCircle size={14} weight="fill" style={{ color: 'var(--color-success)' }} />
          <span style={{ color: dark ? '#fff' : 'var(--color-text-primary)' }}>Sheet actualizado</span>
          <span
            style={{
              color: dark ? '#fff' : 'var(--color-primary)',
              fontWeight: 500,
              textDecoration: 'underline',
            }}
          >
            Abrir →
          </span>
        </a>
      ) : estado === 'error' ? (
        <button
          onClick={() => setConfirmar(true)}
          className={dark ? undefined : 'btn-ghost'}
          title={errorMsg || undefined}
          style={dark ? botonStyle : { fontSize: 13, padding: '8px 12px', minHeight: 36, color: 'var(--color-error)' }}
        >
          <XCircle size={14} weight="fill" style={{ color: 'var(--color-error)' }} />
          Error al exportar · Reintentar
        </button>
      ) : (
        <button
          onClick={() => setConfirmar(true)}
          disabled={estado === 'loading' || leads.length === 0}
          title={leads.length === 0 ? 'No hay leads que exportar' : undefined}
          style={botonStyle}
          onMouseEnter={(e) => {
            if (estado === 'loading') return
            if (dark) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
            else {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.1)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }
          }}
          onMouseLeave={(e) => {
            if (dark) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            else {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              e.currentTarget.style.transform = 'translateY(0)'
            }
          }}
        >
          {estado === 'loading' ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span style={{ color: dark ? '#fff' : 'var(--color-text-secondary)' }}>Exportando {leads.length} leads…</span>
            </>
          ) : (
            <>
              <SheetsIcon size={16} />
              Exportar a Sheets
            </>
          )}
        </button>
      )}

      {/* Modal de confirmación */}
      {confirmar && (
        <div
          onClick={() => setConfirmar(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-export-sheets"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            padding: 24,
            animation: 'fade-in 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: 28, maxWidth: 420, width: '100%' }}>
            <h2 id="titulo-export-sheets" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <SheetsIcon size={20} />
              Exportar a Google Sheets
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Se exportarán <strong style={{ color: 'var(--color-text-primary)' }}>{leads.length} {leads.length === 1 ? 'lead' : 'leads'}</strong> con
              toda su información, incluyendo scores, MRR estimado y estado de demo.
            </p>
            <div
              style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid var(--color-primary-subtle)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 24,
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 400 }}>
                Si el sheet ya existe, se actualizará.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn-primary" onClick={exportar}>Exportar ahora</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
