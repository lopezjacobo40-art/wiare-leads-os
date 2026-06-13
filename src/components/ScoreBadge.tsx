interface Props {
  score: number | null
  size?: 'sm' | 'md'
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
  if (score == null) {
    return (
      <span
        className="badge"
        style={{
          ...sizeStyle(size),
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-tertiary)',
          border: '1px solid var(--color-border)',
        }}
      >
        Sin score
      </span>
    )
  }

  let bg: string, color: string, border: string, label: string, pulse = false
  if (score <= 3) {
    bg = 'rgba(239,68,68,0.08)'; color = 'var(--color-error)'; border = 'rgba(239,68,68,0.15)'; label = 'Frío'
  } else if (score <= 6) {
    bg = 'rgba(245,158,11,0.08)'; color = 'var(--color-warning)'; border = 'rgba(245,158,11,0.15)'; label = 'Templado'
  } else if (score <= 8) {
    bg = 'rgba(34,197,94,0.08)'; color = 'var(--color-success)'; border = 'rgba(34,197,94,0.15)'; label = 'Caliente'
  } else {
    bg = 'var(--color-primary-subtle)'; color = 'var(--color-primary)'; border = 'rgba(99,102,241,0.2)'; label = 'Top'; pulse = true
  }

  return (
    <span
      className="badge"
      style={{ ...sizeStyle(size), background: bg, color, border: `1px solid ${border}` }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          animation: pulse ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
        }}
      />
      {score} · {label}
    </span>
  )
}

function sizeStyle(size: 'sm' | 'md'): React.CSSProperties {
  return {
    fontSize: size === 'sm' ? 11 : 12,
    padding: size === 'sm' ? '2px 8px' : '3px 10px',
  }
}
