import { ESTILOS_RENDER, setEstiloDefault, type EstiloRender } from '../../lib/renderCarousel'
import { useBrandKit } from '../../lib/brandKit'

/* ─────────────────────────────────────────────
   Selector de estilo visual para los renders (carruseles/historias).
   Tres tratamientos, todos con los colores del brand kit:
   Editorial (blanco), Tinta (oscuro), Marca (degradado).
   La elección se recuerda como preferencia (localStorage).
   ───────────────────────────────────────────── */

export default function EstiloSelector({
  valor, onChange,
}: {
  valor: EstiloRender
  onChange: (e: EstiloRender) => void
}) {
  const { brand } = useBrandKit()
  const indigo = brand?.colores.indigo ?? '#6366F1'
  const cyan = brand?.colores.cyan ?? '#22D3EE'
  const gradiente = `linear-gradient(135deg, ${indigo} 0%, ${cyan} 100%)`

  // Mini-muestra del estilo: fondo + línea de "texto" + punto de acento
  const muestra = (id: EstiloRender): { bg: string; linea: string; punto: string } => {
    if (id === 'tinta') return { bg: '#09090B', linea: '#FFFFFF', punto: cyan }
    if (id === 'marca') return { bg: gradiente, linea: '#FFFFFF', punto: 'rgba(255,255,255,0.9)' }
    return { bg: '#FFFFFF', linea: '#09090B', punto: cyan }
  }

  const elegir = (id: EstiloRender) => {
    setEstiloDefault(id)
    onChange(id)
  }

  return (
    <div role="radiogroup" aria-label="Estilo visual del diseño" style={{ display: 'flex', gap: 6 }}>
      {ESTILOS_RENDER.map((e) => {
        const activo = valor === e.id
        const m = muestra(e.id)
        return (
          <button
            key={e.id}
            role="radio"
            aria-checked={activo}
            onClick={() => elegir(e.id)}
            title={`Estilo ${e.label}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              padding: 6,
              minHeight: 'auto',
              background: activo ? 'var(--color-primary-subtle)' : 'transparent',
              border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'border-color 150ms cubic-bezier(0.4,0,0.2,1), background 150ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: 34,
                height: 42,
                borderRadius: 5,
                background: m.bg,
                border: '1px solid var(--color-border)',
                padding: 5,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.punto, display: 'block' }} />
              <span style={{ display: 'block' }}>
                <span style={{ display: 'block', height: 3, width: '100%', borderRadius: 2, background: m.linea }} />
                <span style={{ display: 'block', height: 3, width: '65%', borderRadius: 2, background: m.linea, opacity: 0.6, marginTop: 2 }} />
              </span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: activo ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
              {e.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
