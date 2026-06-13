import { useState } from 'react'
import { GoogleLogo, CheckCircle, XCircle, ArrowSquareOut } from '@phosphor-icons/react'
import type { Lead } from '../lib/supabaseClient'
import { exportarASheets } from '../lib/googleSheets'

type Estado = 'idle' | 'loading' | 'success' | 'error'

/* Botón de exportación a Google Sheets con modal de confirmación.
   Exporta exactamente los leads recibidos (los filtrados visibles en Leads.tsx). */
export default function ExportSheet({ leads }: { leads: Lead[] }) {
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al exportar')
      setEstado('error')
    }
  }

  return (
    <>
      {/* Botón / estado */}
      {estado === 'success' ? (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
          style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}
        >
          <CheckCircle size={16} weight="fill" style={{ color: 'var(--color-success)' }} />
          Sheet actualizado
          <ArrowSquareOut size={14} style={{ color: 'var(--color-primary)' }} />
        </a>
      ) : (
        <button
          className="btn-secondary"
          onClick={() => setConfirmar(true)}
          disabled={estado === 'loading' || leads.length === 0}
          title={leads.length === 0 ? 'No hay leads que exportar' : undefined}
        >
          {estado === 'loading' ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Exportando {leads.length} leads…
            </>
          ) : estado === 'error' ? (
            <>
              <XCircle size={16} weight="fill" style={{ color: 'var(--color-error)' }} />
              Reintentar
            </>
          ) : (
            <>
              <GoogleLogo size={16} weight="bold" />
              Exportar a Google Sheets
            </>
          )}
        </button>
      )}

      {/* Mensaje de error inline (debajo, sin romper el layout del header) */}
      {estado === 'error' && errorMsg && (
        <span style={{ fontSize: 12, color: 'var(--color-error)', maxWidth: 280, lineHeight: 1.4 }}>
          {errorMsg}
        </span>
      )}

      {/* Modal de confirmación */}
      {confirmar && (
        <div
          onClick={() => setConfirmar(false)}
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
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: 28, maxWidth: 400, width: '100%' }}>
            <h2 style={{ fontSize: 18, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <GoogleLogo size={20} weight="bold" style={{ color: 'var(--color-primary)' }} />
              Exportar a Google Sheets
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Vas a exportar <strong style={{ color: 'var(--color-text-primary)' }}>{leads.length} {leads.length === 1 ? 'lead' : 'leads'}</strong> a Google Sheets.
              Si ya existe el sheet maestro, se actualizará.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn-primary" onClick={exportar}>Exportar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
