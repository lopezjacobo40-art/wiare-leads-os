import type { CSSProperties } from 'react'

/* ─────────────────────────────────────────────
   Skeleton loaders con shimmer.
   Mejora la percepción de velocidad frente al spinner
   (progressive-loading: skeleton para operaciones >1s).
   El shimmer respeta prefers-reduced-motion vía globals.css.
   ───────────────────────────────────────────── */

const shimmerStyle: CSSProperties = {
  background: 'linear-gradient(90deg, #F0F0F0 25%, #E8E8E8 50%, #F0F0F0 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s infinite',
}

function Line({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: 'var(--radius-sm)',
        ...shimmerStyle,
        ...style,
      }}
    />
  )
}

function Rect({ width = 40, height = 40, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        ...shimmerStyle,
        ...style,
      }}
    />
  )
}

function Circle({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        ...shimmerStyle,
        ...style,
      }}
    />
  )
}

/* ── Preset: tarjeta de métrica (Dashboard) ── */
function Card() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <Rect width={36} height={36} radius={10} />
        <Line width={52} height={22} />
      </div>
      <Line width="55%" height={28} style={{ marginBottom: 8 }} />
      <Line width="40%" height={12} />
    </div>
  )
}

/* ── Preset: fila de tabla (Leads), height 52px ── */
function Row() {
  return (
    <tr style={{ height: 52, borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ padding: '0 16px' }}><Line width={60} height={20} /></td>
      <td style={{ padding: '0 16px' }}><Line width={140} /></td>
      <td style={{ padding: '0 16px' }}><Line width={90} /></td>
      <td style={{ padding: '0 16px' }}><Line width={80} /></td>
      <td style={{ padding: '0 16px' }}><Line width={100} /></td>
      <td className="col-resenas" style={{ padding: '0 16px' }}><Line width={40} /></td>
      <td className="col-valoracion" style={{ padding: '0 16px' }}><Line width={40} /></td>
      <td style={{ padding: '0 16px' }}><Line width={90} /></td>
      <td style={{ padding: '0 16px' }}><Line width={70} height={20} /></td>
    </tr>
  )
}

/* ── Preset: detalle de lead (layout 2 columnas) ── */
function Detalle() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Line width="50%" height={16} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <Circle size={16} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Line width="40%" height={10} />
              <Line width="75%" height={14} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <Line key={i} width={100} height={20} />)}
        </div>
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Line width="40%" height={18} />
          <Line width="100%" />
          <Line width="90%" />
          <Line width="95%" />
          <Line width={160} height={36} style={{ marginTop: 8 }} />
        </div>
      </div>
    </div>
  )
}

const Skeleton = { Line, Rect, Circle, Card, Row, Detalle }
export default Skeleton
