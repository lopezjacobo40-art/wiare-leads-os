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
import Sidebar from './components/Sidebar'

function Shell({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Cierra el drawer al navegar
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

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

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  return <Shell onLogout={() => setUser(null)} />
}
