interface Props {
  progress: number // 0-100
  label?: string
}

export default function LoadingBar({ progress, label }: Props) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</p>
      )}
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'var(--bg-surface)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: 'var(--gradient-main)',
            borderRadius: 999,
            transition: 'width 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}
