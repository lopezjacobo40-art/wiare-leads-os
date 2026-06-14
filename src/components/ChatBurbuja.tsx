import { motion } from 'framer-motion'
import { User, Robot } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/* ─────────────────────────────────────────────
   Burbuja de mensaje reutilizable (Simulador + Consultor).
   autor 'user' → derecha, gradiente de marca.
   autor 'ia'   → izquierda, superficie clara con avatar.
   Entra con fade + translateY ≤300ms (transform/opacity).
   ───────────────────────────────────────────── */

interface Props {
  autor: 'user' | 'ia'
  children: ReactNode
  /* Etiqueta del avatar de la IA (p.ej. "Cliente", "Consultor"). */
  iaLabel?: string
}

export default function ChatBurbuja({ autor, children, iaLabel = 'IA' }: Props) {
  const esUser = autor === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: esUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
      }}
    >
      {/* Avatar */}
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: esUser ? 'var(--gradient-brand)' : 'var(--color-surface-2)',
          color: esUser ? '#fff' : 'var(--color-text-secondary)',
        }}
      >
        {esUser ? <User size={15} weight="fill" /> : <Robot size={15} weight="fill" />}
      </span>

      {/* Mensaje */}
      <div
        style={{
          maxWidth: 'min(78%, 560px)',
          padding: '10px 14px',
          borderRadius: 14,
          borderBottomRightRadius: esUser ? 4 : 14,
          borderBottomLeftRadius: esUser ? 14 : 4,
          background: esUser ? 'var(--gradient-brand)' : '#fff',
          color: esUser ? '#fff' : 'var(--color-text-primary)',
          border: esUser ? 'none' : '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          fontSize: 14,
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}
      >
        {!esUser && (
          <span
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary)',
              marginBottom: 4,
            }}
          >
            {iaLabel}
          </span>
        )}
        {children}
      </div>
    </motion.div>
  )
}

/* Indicador "escribiendo…" con 3 puntos (reusa pulse-dot del design system). */
export function EscribiendoDots({ iaLabel = 'IA' }: { iaLabel?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <span
        aria-hidden="true"
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)',
        }}
      >
        <Robot size={15} weight="fill" />
      </span>
      <div
        role="status"
        aria-label={`${iaLabel} está escribiendo`}
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          borderBottomLeftRadius: 4,
          background: '#fff',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-text-tertiary)',
              animation: 'pulse-dot 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
