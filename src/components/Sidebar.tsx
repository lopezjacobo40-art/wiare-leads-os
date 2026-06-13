import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ChartBar, MagnifyingGlass, Users, SignOut, Warning } from '@phosphor-icons/react'
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
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{ padding: '0 12px', marginBottom: 32 }}>
        <img src="/logo-wiare.png" alt="WIARE" style={{ height: 28, objectFit: 'contain', display: 'block' }} />
        <p
          style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 11,
            marginTop: 8,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Leads OS
        </p>
      </div>

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
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                minHeight: 36,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
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

      {/* Footer — usuario + logout */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', marginBottom: 4 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--gradient-brand)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {inicial}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              textTransform: 'capitalize',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user || 'WIARE'}
          </span>
        </div>

        {uso && (() => {
          const ratio = Math.max(
            uso.limiteScore ? uso.score / uso.limiteScore : 0,
            uso.limiteContent ? uso.content / uso.limiteContent : 0
          )
          const alLimite = ratio >= 1
          const cerca = ratio >= 0.8
          const color = alLimite
            ? 'var(--color-error)'
            : cerca
            ? 'var(--color-warning)'
            : 'var(--color-text-tertiary)'
          return (
            <p
              style={{
                fontSize: 11,
                fontWeight: 400,
                color,
                padding: '0 12px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {alLimite && <Warning size={12} weight="fill" />}
              Hoy: {uso.score} scores · {uso.content} contenidos
            </p>
          )
        })()}

        <button
          onClick={logout}
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13, padding: '8px 12px', minHeight: 36 }}
        >
          <SignOut size={16} style={{ flexShrink: 0 }} />
          Cerrar sesión
        </button>
      </div>
    </aside>
    </>
  )
}
