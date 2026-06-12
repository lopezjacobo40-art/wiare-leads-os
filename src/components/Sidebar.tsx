import { NavLink, useNavigate } from 'react-router-dom'
import { House, MagnifyingGlass, Users, SignOut } from '@phosphor-icons/react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: House, end: true },
  { to: '/extraer', label: 'Extraer leads', icon: MagnifyingGlass, end: false },
  { to: '/leads', label: 'Todos los leads', icon: Users, end: false },
]

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()

  const logout = () => {
    sessionStorage.removeItem('wiare_user')
    onLogout()
    navigate('/')
  }

  return (
    <aside
      className="sidebar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        background: '#fff',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        zIndex: 10,
      }}
    >
      <div style={{ padding: '0 12px', marginBottom: 32 }}>
        <img src="/logo-wiare.png" alt="WIARE" style={{ height: 36, objectFit: 'contain' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6, fontWeight: 500, letterSpacing: 0.5 }}>
          LEADS OS
        </p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              minHeight: 44,
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
              textDecoration: 'none',
            })}
          >
            <Icon size={20} weight="duotone" />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 12px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 500,
          background: 'transparent',
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}
      >
        <SignOut size={20} weight="duotone" />
        Cerrar sesión
      </button>
    </aside>
  )
}
