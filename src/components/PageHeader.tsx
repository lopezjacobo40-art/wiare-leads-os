import type { ReactNode } from 'react'

interface Props {
  titulo: string
  subtitulo?: string
  acciones?: ReactNode
}

/* Header horizontal superior de cada página: título + subtítulo + acciones a la derecha. */
export default function PageHeader({ titulo, subtitulo, acciones }: Props) {
  return (
    <div
      className="page-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        padding: 'var(--space-5) var(--space-8)',
        margin: 'calc(-1 * var(--space-8)) calc(-1 * var(--space-8)) var(--space-8)',
        background: '#fff',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
          {titulo}
        </h1>
        {subtitulo && (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {subtitulo}
          </p>
        )}
      </div>
      {acciones && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{acciones}</div>}
    </div>
  )
}
