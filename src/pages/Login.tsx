import { useState } from 'react'
import { motion } from 'framer-motion'

const USERS: Record<string, string> = {
  [import.meta.env.VITE_AUTH_USER_1 ?? 'jacobo']: import.meta.env.VITE_AUTH_PASS_1 ?? '',
  [import.meta.env.VITE_AUTH_USER_2 ?? 'socio']: import.meta.env.VITE_AUTH_PASS_2 ?? '',
}

export default function Login({ onLogin }: { onLogin: (user: string) => void }) {
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = usuario.trim().toLowerCase()
    if (USERS[u] && USERS[u] === pass) {
      sessionStorage.setItem('wiare_user', u)
      onLogin(u)
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at top left, rgba(99,102,241,0.08), transparent 50%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.08), transparent 50%), var(--bg-base)',
        padding: 24,
      }}
    >
      <motion.form
        onSubmit={submit}
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 380, padding: 40, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <img
          src="/logo-wiare.png"
          alt="WIARE"
          style={{ height: 48, objectFit: 'contain', alignSelf: 'center', marginBottom: 4 }}
        />
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22 }}>Leads OS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Sistema interno de prospección
          </p>
        </div>
        <input
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {error && <p style={{ color: 'var(--red)', fontSize: 14 }}>{error}</p>}
        <button type="submit" className="btn-gradient">
          Entrar →
        </button>
      </motion.form>
    </div>
  )
}
