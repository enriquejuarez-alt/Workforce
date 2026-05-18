import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import { PageLoading } from './components/ui/LoadingSpinner'
import { canAccess, getDefaultPath } from './utils/roles'
import type { Rol } from './types'

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
const Ausentismo = lazy(() => import('./pages/Ausentismo'))
const HistorialAgente = lazy(() => import('./pages/HistorialAgente'))
const AccesoDenegado = lazy(() => import('./pages/AccesoDenegado'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

/** Requiere uno de los roles indicados; de lo contrario redirige a /acceso-denegado */
function RoleRoute({ children, roles }: { children: React.ReactNode; roles: Rol[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.rol)) return <Navigate to="/acceso-denegado" replace />
  return <>{children}</>
}

/** Requiere que el usuario sea ADMINISTRADOR */
function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['ADMINISTRADOR']}>{children}</RoleRoute>
}

/** Redirige al path inicial según el rol del usuario autenticado */
function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={getDefaultPath(user?.rol)} replace />
}

/** Protege una ruta por path usando la matriz de permisos centralizada */
function PathGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canAccess(user.rol, path)) return <Navigate to="/acceso-denegado" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/acceso-denegado" element={<AccesoDenegado />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<RootRedirect />} />

            <Route path="dashboard"        element={<PathGuard path="/dashboard"><Dashboard /></PathGuard>} />
            <Route path="nomina"           element={<PathGuard path="/nomina"><Nomina /></PathGuard>} />
            <Route path="nomina/agente/:id" element={<PathGuard path="/nomina"><AgenteDetalle /></PathGuard>} />
            <Route path="licencias"        element={<PathGuard path="/licencias"><Licencias /></PathGuard>} />
            <Route path="cambios"          element={<PathGuard path="/cambios"><CambiosTemporales /></PathGuard>} />
            <Route path="bajas"            element={<PathGuard path="/bajas"><Bajas /></PathGuard>} />
            <Route path="cambios-contrato" element={<Navigate to="/cambios" replace />} />
            <Route path="capacitaciones"   element={<PathGuard path="/capacitaciones"><Capacitaciones /></PathGuard>} />
            <Route path="remociones"       element={<Navigate to="/bajas" replace />} />
            <Route path="vacaciones"       element={<PathGuard path="/vacaciones"><Vacaciones /></PathGuard>} />
            <Route path="comparacion"      element={<PathGuard path="/comparacion"><Comparacion /></PathGuard>} />
            <Route path="ausentismo"       element={<PathGuard path="/ausentismo"><Ausentismo /></PathGuard>} />
            <Route path="historial-agente" element={<PathGuard path="/historial-agente"><HistorialAgente /></PathGuard>} />
            <Route path="planificacion"    element={<PathGuard path="/planificacion"><Planificacion /></PathGuard>} />
            <Route path="soporte"          element={<PathGuard path="/soporte"><Soporte /></PathGuard>} />
            <Route path="calendario"       element={<PathGuard path="/calendario"><Calendario /></PathGuard>} />
            <Route path="programacion"     element={<PathGuard path="/programacion"><Programacion /></PathGuard>} />
            <Route path="programacion/:id" element={<PathGuard path="/programacion"><ProgramacionDetalle /></PathGuard>} />
            <Route path="distribucion"     element={<PathGuard path="/distribucion"><Distribucion /></PathGuard>} />

            {/* Rutas exclusivas de ADMINISTRADOR */}
            <Route path="carga"         element={<AdminRoute><CargaExcel /></AdminRoute>} />
            <Route path="importaciones" element={<AdminRoute><Importaciones /></AdminRoute>} />
            <Route path="usuarios"      element={<AdminRoute><Usuarios /></AdminRoute>} />
            <Route path="permisos"      element={<AdminRoute><Permisos /></AdminRoute>} />
            <Route path="servicios"     element={<AdminRoute><Servicios /></AdminRoute>} />
            <Route path="auditoria"     element={<AdminRoute><Auditoria /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
