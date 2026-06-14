import { Globe } from '@phosphor-icons/react'

interface Props {
  fuente: string | null
  size?: 'sm' | 'md'
}

/* Badge "Lead Web" — solo se muestra para leads venidos de wiaresolution.com. */
export default function FuenteBadge({ fuente, size = 'sm' }: Props) {
  if (fuente !== 'web_calculadora') return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 9999,
        color: '#16A34A',
        fontSize: size === 'sm' ? 10 : 12,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      <Globe size={size === 'sm' ? 10 : 12} weight="fill" />
      Lead Web
    </span>
  )
}
