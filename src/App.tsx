import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Extraccion from './pages/Extraccion'
import Leads from './pages/Leads'
import LeadDetalle from './pages/LeadDetalle'
import Configuracion from './pages/Configuracion'
import Roadmap from './pages/Roadmap'
import Consultor from './pages/Consultor'
import BrandKit from './pages/content/BrandKit'
import DemoPlayer from './pages/DemoPlayer'
import Sidebar from './components/Sidebar'
import BrandKitProvider from './components/BrandKitProvider'
import { useToast } from './components/Toast'
import { supabase, usernameFromSession } from './lib/supabaseClient'

/* Layout del módulo de Content: provee el brand kit a todas sus páginas. */
function ContentLayout() {
  return (
    <BrandKitProvider>
      <Outlet />
    </BrandKitProvider>
  )
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const toast = useToast()

  // Cierra el drawer al navegar
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Radar de Telemetría
  useEffect(() => {
    const channel = supabase.channel('telemetria_radar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telemetria_os' }, async (payload) => {
        if (payload.new.evento === 'demo_escuchada') {
          const { data } = await supabase.from('leads_os').select('nombre').eq('id', payload.new.lead_id).single()
          const nombre = data?.nombre || 'Un prospecto'
          toast(`¡${nombre} está escuchando tu demo de voz ahora mismo!`, 'info')
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [toast])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onLogout={onLogout} />
      <main className="main-content" style={{ marginLeft: 220, flex: 1, padding: '32px 40px', minWidth: 0 }}>
        {/* Header móvil con hamburguesa */}
        <div className="mobile-header no-print" style={{ display: 'none' }}>
          <button
            className="menu-toggle"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(true)}
          >
            <List size={20} />
          </button>
          <img src="/logo-wiare.png" alt="WIARE" style={{ height: 24, objectFit: 'contain' }} />
        </div>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/extraer" element={<Extraccion />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetalle />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/roadmap" element={<Roadmap />} />
          {/* /simulador y /biblioteca redirigen a sus nuevas ubicaciones integradas */}
          <Route path="/simulador" element={<Navigate to="/roadmap?tab=simulador" replace />} />
          <Route path="/biblioteca" element={<Navigate to="/leads?analizados=1" replace />} />
          <Route path="/consultor" element={<Consultor />} />
          {/* ── Módulo Content OS (nuevo) ── */}
          <Route path="/content" element={<ContentLayout />}>
            <Route index element={<Navigate to="/content/brand-kit" replace />} />
            <Route path="brand-kit" element={<BrandKit />} />
          </Route>
          {/* Rutas del módulo de contenido antiguo, retiradas del sidebar (se eliminan al cerrar el nuevo módulo) */}
          <Route path="/contenido/*" element={<Navigate to="/content/brand-kit" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<string | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const location = useLocation()

  // Restaura la sesión de Supabase Auth al montar y escucha cambios (login/logout/refresh)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const username = usernameFromSession(session)
      if (username) sessionStorage.setItem('wiare_user', username)
      setUser(username)
      setCargandoSesion(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const username = usernameFromSession(session)
      if (username) sessionStorage.setItem('wiare_user', username)
      else sessionStorage.removeItem('wiare_user')
      setUser(username)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Ruta pública para leads (bypass de autenticación)
  if (location.pathname.startsWith('/d/')) {
    return (
      <Routes>
        <Route path="/d/:id" element={<DemoPlayer />} />
      </Routes>
    )
  }

  if (cargandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  return <Shell onLogout={() => { supabase.auth.signOut() }} />
}
