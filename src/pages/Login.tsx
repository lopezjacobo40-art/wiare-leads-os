import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'


export default function Login({ onLogin }: { onLogin: (user: string) => void }) {
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = usuario.trim().toLowerCase()
    // El login pide solo el nombre; internamente cada usuario es <nombre>@wiare.app en Supabase Auth
    const email = u.includes('@') ? u : `${u}@wiare.app`

    setLoading(true)
    setError('')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      })

      if (authError || !data.session) {
        setError('Usuario o contraseña incorrectos')
      } else {
        const username = (data.session.user.user_metadata?.username as string | undefined) ?? u
        sessionStorage.setItem('wiare_user', username)
        onLogin(username)
      }
    } catch {
      setError('Error conectando al servidor')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 6,
    display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0 12px',
    fontSize: 14,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle, rgba(99,102,241,0.10) 1px, transparent 1px) 0 0 / 28px 28px, var(--color-surface)',
        padding: 24,
      }}
    >
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo + título */}
        <img
          src="/logo-wiare.png"
          alt="WIARE"
          style={{ height: 32, objectFit: 'contain', alignSelf: 'center' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            marginTop: 8,
          }}
        >
          Leads OS
        </p>

        <div style={{ height: 1, background: 'var(--color-border)', margin: '32px 0' }} />

        {/* Campos */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="usuario" style={labelStyle}>Usuario</label>
          <input
            id="usuario"
            name="username"
            autoComplete="username"
            placeholder="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={labelStyle}>Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} /> {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%', height: 44 }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </motion.form>
    </div>
  )
}
