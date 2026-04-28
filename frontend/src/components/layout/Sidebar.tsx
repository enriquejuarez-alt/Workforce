import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, FileSpreadsheet, Upload,
  ClipboardList, ArrowLeftRight, Shield, GitCompare,
  LogOut, ChevronRight, Activity, History, UserMinus, FilePen, GraduationCap, UserX,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/nomina', icon: FileSpreadsheet, label: 'Nómina' },
  { to: '/licencias', icon: ClipboardList, label: 'Licencias' },
  { to: '/cambios', icon: ArrowLeftRight, label: 'Cambios Temporales' },
  { to: '/bajas', icon: UserMinus, label: 'Bajas' },
  { to: '/cambios-contrato', icon: FilePen, label: 'Cambios de Contrato' },
  { to: '/capacitaciones', icon: GraduationCap, label: 'Capacitaciones' },
  { to: '/remociones', icon: UserX, label: 'Remociones' },
  { to: '/comparacion', icon: GitCompare, label: 'Comparar Nóminas' },
]

const ADMIN_ITEMS = [
  { to: '/carga', icon: Upload, label: 'Carga de Excel' },
  { to: '/importaciones', icon: History, label: 'Historial Importaciones' },
  { to: '/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/servicios', icon: Building2, label: 'Servicios' },
  { to: '/auditoria', icon: Activity, label: 'Auditoría' },
]

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {}
    clearAuth()
    toast.success('Sesión cerrada')
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-konecta flex items-center justify-center shrink-0">
          <span className="text-white font-black text-sm">K</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Konecta</p>
          <p className="text-sidebar-text text-xs">Gestión de Nómina</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="mb-1">
          <p className="section-title text-white/30 px-3 mb-2">Principal</p>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 group ${
                  isActive
                    ? 'bg-konecta text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight
                size={12}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                  location.pathname === to ? 'opacity-100' : ''
                }`}
              />
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-4">
            <p className="section-title text-white/30 px-3 mb-2">Administración</p>
            {ADMIN_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 group ${
                    isActive
                      ? 'bg-konecta text-white'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-hover transition-colors">
          <div className="w-8 h-8 rounded-full bg-konecta flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.nombre}</p>
            <p className="text-sidebar-text text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sidebar-text hover:text-red-400 transition-colors p-1 rounded"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
        {isAdmin && (
          <div className="mt-1 px-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-konecta">
              <Shield size={10} /> Administrador
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
