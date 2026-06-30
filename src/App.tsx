import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Extraccion from './pages/Extraccion'
import Leads from './pages/Leads'
import LeadDetalle from './pages/LeadDetalle'
import Configuracion from './pages/Configuracion'
import Roadmap from './pages/Roadmap'
import Simulador from './pages/Simulador'
import Consultor from './pages/Consultor'
import Biblioteca from './pages/Biblioteca'
import Generador from './pages/contenido/Generador'
import Calendario from './pages/contenido/Calendario'
import BibliotecaContent from './pages/contenido/BibliotecaContent'
import DemoPlayer from './pages/DemoPlayer'
import Sidebar from './components/Sidebar'
import { useToast } from './components/Toast'
import { supabase } from './lib/supabaseClient'

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
          toast(`🔥 ¡${nombre} está escuchando tu demo de voz ahora mismo!`, 'info')
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
          <Route path="/simulador" element={<Simulador />} />
          <Route path="/consultor" element={<Consultor />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/contenido/generador" element={<Generador />} />
          <Route path="/contenido/calendario" element={<Calendario />} />
          <Route path="/contenido/biblioteca" element={<BibliotecaContent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<string | null>(sessionStorage.getItem('wiare_user'))
  const location = useLocation()

  // Ruta pública para leads (bypass de autenticación)
  if (location.pathname.startsWith('/d/')) {
    return (
      <Routes>
        <Route path="/d/:id" element={<DemoPlayer />} />
      </Routes>
    )
  }

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  return <Shell onLogout={() => setUser(null)} />
}
