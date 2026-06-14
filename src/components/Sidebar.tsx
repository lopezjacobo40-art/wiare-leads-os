import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ChartBar, MagnifyingGlass, Users, SignOut, Warning, GearSix } from '@phosphor-icons/react'
import { getUsoHoy, type UsoHoy } from '../lib/tokenGuard'
import { supabase } from '../lib/supabaseClient'

const NAV = [
  { to: '/', label: 'Dashboard', icon: ChartBar, end: true },
  { to: '/extraer', label: 'Extraer leads', icon: MagnifyingGlass, end: false },
  { to: '/leads', label: 'Todos los leads', icon: Users, end: false },
]

interface SidebarProps {
  onLogout: () => void
  open?: boolean
  onClose?: () => void
}

// "hace X" en español, a partir de una fecha ISO.
function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export default function Sidebar({ onLogout, open = false, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = sessionStorage.getItem('wiare_user') ?? ''
  const inicial = user.charAt(0).toUpperCase() || 'W'

  const [uso, setUso] = useState<UsoHoy | null>(null)
  const [totalLeads, setTotalLeads] = useState<number | null>(null)
  const [ultimaExtraccion, setUltimaExtraccion] = useState<string | null>(null)

  useEffect(() => {
    getUsoHoy().then(setUso).catch(() => {})
    // Total de leads (solo el count, sin traer filas)
    supabase
      .from('leads_os')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setTotalLeads(count ?? 0))
    // Última extracción
    supabase
      .from('extracciones_os')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setUltimaExtraccion(data?.[0]?.created_at ?? null))
  }, [location.pathname])

  const logout = () => {
    sessionStorage.removeItem('wiare_user')
    onLogout()
    navigate('/')
  }

  // Barra de uso de tokens: ratio respecto al límite más cercano.
  const usoRatio = uso
    ? Math.min(
        1,
        Math.max(
          uso.limiteScore ? uso.score / uso.limiteScore : 0,
          uso.limiteContent ? uso.content / uso.limiteContent : 0
        )
      )
    : 0
  const usoAlLimite = usoRatio >= 1
  const usoCerca = usoRatio >= 0.8
  const usoColor = usoAlLimite
    ? 'var(--color-error)'
    : usoCerca
    ? 'var(--color-warning)'
    : 'var(--color-text-tertiary)'

  return (
    <>
    <div
      className={`sidebar-overlay${open ? ' open' : ''}`}
      onClick={onClose}
      aria-hidden="true"
    />
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        background: '#fff',
        borderRight: '1px solid var(--color-border)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        zIndex: 10,
      }}
    >
      {/* Header — logo + label LEADS OS */}
      <div style={{ padding: '24px 20px 0' }}>
        <img
          src="/logo-wiare.png"
          alt="WIARE"
          style={{ height: 32, objectFit: 'contain', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <p
          style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 10,
            marginTop: 8,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Leads OS
        </p>
      </div>

      {/* Label de grupo de navegación */}
      <p
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '16px 20px 8px',
        }}
      >
        Menú
      </p>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.map(({ to, label, icon: Icon, end }) => {
          const badge = to === '/leads' && totalLeads != null ? totalLeads : null
          const subtexto =
            to === '/extraer' && ultimaExtraccion ? tiempoRelativo(ultimaExtraccion) : null
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                margin: '2px 8px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                minHeight: 44,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} weight={isActive ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                    {label}
                    {subtexto && (
                      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                        {subtexto}
                      </span>
                    )}
                  </span>
                  {badge != null && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        minWidth: 20,
                        textAlign: 'center',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        background: isActive ? 'var(--color-primary)' : 'var(--color-surface-2)',
                        color: isActive ? '#fff' : 'var(--color-text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Configuración — solo visible para el admin (jacobo) */}
      {user === 'jacobo' && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0' }}>
          <NavLink
            to="/configuracion"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              margin: '2px 8px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              minHeight: 44,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), color 150ms cubic-bezier(0.4,0,0.2,1)',
            })}
          >
            {({ isActive }) => (
              <>
                <GearSix size={16} weight={isActive ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>Configuración</span>
              </>
            )}
          </NavLink>
        </div>
      )}

      {/* Footer — usuario + uso + logout */}
      <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--gradient-brand)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {inicial}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.3 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                textTransform: 'capitalize',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user || 'WIARE'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
              Administrador
            </span>
          </span>
        </div>

        {uso && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                height: 4,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-surface-2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${usoRatio * 100}%`,
                  borderRadius: 'var(--radius-full)',
                  background: usoAlLimite ? 'var(--color-error)' : 'var(--color-primary)',
                  transition: 'width 250ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: usoColor,
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {usoAlLimite && <Warning size={12} weight="fill" />}
              Hoy: {uso.score} scores · {uso.content} contenidos
            </p>
          </div>
        )}

        <button
          onClick={logout}
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13, padding: '10px 12px', minHeight: 44 }}
        >
          <SignOut size={16} style={{ flexShrink: 0 }} />
          Cerrar sesión
        </button>
      </div>
    </aside>
    </>
  )
}
