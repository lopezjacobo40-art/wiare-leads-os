import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

interface Props {
  icon: PhosphorIcon
  titulo: string
  descripcion?: string
  accion?: { label: string; onClick: () => void }
  compacto?: boolean
}

/* Estado vacío reutilizable: icono grande tenue + título + acción opcional. */
export default function EmptyState({ icon: Icon, titulo, descripcion, accion, compacto }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 8,
        padding: compacto ? '32px 20px' : '64px 24px',
      }}
    >
      <Icon size={compacto ? 36 : 48} weight="thin" style={{ color: 'var(--color-text-tertiary)' }} />
      <p
        style={{
          fontSize: compacto ? 14 : 16,
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          marginTop: 4,
        }}
      >
        {titulo}
      </p>
      {descripcion && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 320, lineHeight: 1.5 }}>
          {descripcion}
        </p>
      )}
      {accion && (
        <button className="btn-secondary" onClick={accion.onClick} style={{ marginTop: 12 }}>
          {accion.label}
        </button>
      )}
    </div>
  )
}
