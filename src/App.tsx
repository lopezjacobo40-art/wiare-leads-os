import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Extraccion from './pages/Extraccion'
import Leads from './pages/Leads'
import LeadDetalle from './pages/LeadDetalle'
import Sidebar from './components/Sidebar'

export default function App() {
  const [user, setUser] = useState<string | null>(sessionStorage.getItem('wiare_user'))

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={() => setUser(null)} />
      <main
        className="main-content"
        style={{ marginLeft: 220, flex: 1, padding: '32px 40px', minWidth: 0 }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/extraer" element={<Extraccion />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetalle />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
