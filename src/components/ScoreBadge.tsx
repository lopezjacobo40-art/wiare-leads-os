interface Props {
  score: number | null
  size?: 'sm' | 'md'
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
  if (score == null) {
    return (
      <span style={{ ...base(size), background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
        Sin score
      </span>
    )
  }

  let bg: string, color: string, label: string, pulse = false
  if (score <= 3) {
    bg = 'rgba(239,68,68,0.12)'; color = 'var(--red)'; label = 'Frío'
  } else if (score <= 6) {
    bg = 'rgba(249,115,22,0.12)'; color = 'var(--orange)'; label = 'Templado'
  } else if (score <= 8) {
    bg = 'rgba(34,197,94,0.12)'; color = 'var(--green)'; label = 'Caliente'
  } else {
    bg = 'rgba(99,102,241,0.12)'; color = 'var(--accent-primary)'; label = '🔥 Top'; pulse = true
  }

  return (
    <span style={{ ...base(size), background: bg, color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {pulse && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: color,
            animation: 'pulse-dot 1.4s ease-in-out infinite',
          }}
        />
      )}
      {score} · {label}
    </span>
  )
}

function base(size: 'sm' | 'md'): React.CSSProperties {
  return {
    fontSize: size === 'sm' ? 12 : 13,
    fontWeight: 600,
    padding: size === 'sm' ? '3px 8px' : '4px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  }
}
