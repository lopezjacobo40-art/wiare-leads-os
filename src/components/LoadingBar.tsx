interface Props {
  progress: number // 0-100
  label?: string
}

export default function LoadingBar({ progress, label }: Props) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{label}</p>
      )}
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'var(--color-surface-2)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            background: 'var(--gradient-brand)',
            borderRadius: 999,
            transform: `scaleX(${Math.min(100, Math.max(0, progress)) / 100})`,
            transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            transformOrigin: 'left',
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
