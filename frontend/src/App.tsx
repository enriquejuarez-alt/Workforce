import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import { PageLoading } from './components/ui/LoadingSpinner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Nomina = lazy(() => import('./pages/Nomina'))
const AgenteDetalle = lazy(() => import('./pages/AgenteDetalle'))
const CargaExcel = lazy(() => import('./pages/CargaExcel'))
const Importaciones = lazy(() => import('./pages/Importaciones'))
const Licencias = lazy(() => import('./pages/Licencias'))
const CambiosTemporales = lazy(() => import('./pages/CambiosTemporales'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Servicios = lazy(() => import('./pages/Servicios'))
const Permisos = lazy(() => import('./pages/Permisos'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Comparacion = lazy(() => import('./pages/Comparacion'))
const Bajas = lazy(() => import('./pages/Bajas'))
const Capacitaciones = lazy(() => import('./pages/Capacitaciones'))
const Vacaciones = lazy(() => import('./pages/Vacaciones'))
const Planificacion = lazy(() => import('./pages/Planificacion'))
const Soporte = lazy(() => import('./pages/Soporte'))
const Calendario = lazy(() => import('./pages/Calendario'))
const Programacion = lazy(() => import('./pages/Programacion'))
const ProgramacionDetalle = lazy(() => import('./pages/ProgramacionDetalle'))
const Distribucion = lazy(() => import('./pages/Distribucion'))

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
      <Suspense fallback={<PageLoading />}>
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
            <Route path="cambios-contrato" element={<Navigate to="/cambios" replace />} />
            <Route path="capacitaciones" element={<Capacitaciones />} />
            <Route path="remociones" element={<Navigate to="/bajas" replace />} />
            <Route path="vacaciones" element={<Vacaciones />} />
            <Route path="comparacion" element={<Comparacion />} />
            <Route path="planificacion" element={<Planificacion />} />
            <Route path="soporte" element={<Soporte />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="programacion" element={<Programacion />} />
            <Route path="programacion/:id" element={<ProgramacionDetalle />} />
            <Route path="distribucion" element={<Distribucion />} />
            <Route path="carga" element={<AdminRoute><CargaExcel /></AdminRoute>} />
            <Route path="importaciones" element={<AdminRoute><Importaciones /></AdminRoute>} />
            <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
            <Route path="permisos" element={<AdminRoute><Permisos /></AdminRoute>} />
            <Route path="servicios" element={<AdminRoute><Servicios /></AdminRoute>} />
            <Route path="auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
