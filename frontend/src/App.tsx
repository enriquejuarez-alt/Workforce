import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Nomina from './pages/Nomina'
import AgenteDetalle from './pages/AgenteDetalle'
import CargaExcel from './pages/CargaExcel'
import Importaciones from './pages/Importaciones'
import Licencias from './pages/Licencias'
import CambiosTemporales from './pages/CambiosTemporales'
import Usuarios from './pages/Usuarios'
import Servicios from './pages/Servicios'
import Permisos from './pages/Permisos'
import Auditoria from './pages/Auditoria'
import Comparacion from './pages/Comparacion'
import Bajas from './pages/Bajas'
import CambiosContrato from './pages/CambiosContrato'
import Capacitaciones from './pages/Capacitaciones'
import Remociones from './pages/Remociones'
import Vacaciones from './pages/Vacaciones'
import Planificacion from './pages/Planificacion'
import Soporte from './pages/Soporte'
import Calendario from './pages/Calendario'
import Programacion from './pages/Programacion'
import ProgramacionDetalle from './pages/ProgramacionDetalle'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.rol !== 'ADMINISTRADOR') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="nomina" element={<Nomina />} />
          <Route path="nomina/agente/:id" element={<AgenteDetalle />} />
          <Route path="licencias" element={<Licencias />} />
          <Route path="cambios" element={<CambiosTemporales />} />
          <Route path="bajas" element={<Bajas />} />
          <Route path="cambios-contrato" element={<CambiosContrato />} />
          <Route path="capacitaciones" element={<Capacitaciones />} />
          <Route path="remociones" element={<Remociones />} />
          <Route path="vacaciones" element={<Vacaciones />} />
          <Route path="comparacion" element={<Comparacion />} />
          <Route path="planificacion" element={<Planificacion />} />
          <Route path="soporte" element={<Soporte />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="programacion" element={<Programacion />} />
          <Route path="programacion/:id" element={<ProgramacionDetalle />} />
          <Route path="carga" element={<AdminRoute><CargaExcel /></AdminRoute>} />
          <Route path="importaciones" element={<AdminRoute><Importaciones /></AdminRoute>} />
          <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
          <Route path="permisos" element={<AdminRoute><Permisos /></AdminRoute>} />
          <Route path="servicios" element={<AdminRoute><Servicios /></AdminRoute>} />
          <Route path="auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
