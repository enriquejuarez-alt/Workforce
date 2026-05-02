import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, FileSpreadsheet, Upload,
  ClipboardList, ArrowLeftRight, Shield, GitCompare,
  LogOut, Activity, History, UserMinus, FilePen, GraduationCap, UserX, Palmtree,
  BarChart3, CalendarDays, Sliders, TrendingUp, UploadCloud, CalendarClock,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/nomina', icon: FileSpreadsheet, label: 'Nómina' },
  { to: '/licencias', icon: ClipboardList, label: 'Licencias' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
  { to: '/cambios', icon: ArrowLeftRight, label: 'Cambios Temporales' },
  { to: '/bajas', icon: UserMinus, label: 'Bajas' },
  { to: '/cambios-contrato', icon: FilePen, label: 'Cambios de Contrato' },
  { to: '/capacitaciones', icon: GraduationCap, label: 'Capacitaciones' },
  { to: '/remociones', icon: UserX, label: 'Remociones' },
  { to: '/vacaciones', icon: Palmtree, label: 'Vacaciones' },
  { to: '/comparacion', icon: GitCompare, label: 'Comparar Nóminas' },
]

const PROGRAMACION_ITEMS = [
  { to: '/programacion', icon: CalendarClock, label: 'Programación' },
]

const ADMIN_ITEMS = [
  { to: '/carga', icon: Upload, label: 'Carga de Nómina' },
  { to: '/importaciones', icon: History, label: 'Historial Importaciones' },
  { to: '/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/servicios', icon: Building2, label: 'Servicios' },
  { to: '/auditoria', icon: Activity, label: 'Auditoría' },
]

const WALT_ITEMS = [
  { page: 'carga',       icon: UploadCloud,     label: 'Carga de archivos' },
  { page: 'dashboard',   icon: LayoutDashboard, label: 'Resumen' },
  { page: 'analisis',    icon: BarChart3,        label: 'Análisis' },
  { page: 'curvas',      icon: TrendingUp,       label: 'Curvas' },
  { page: 'simulador',   icon: Sliders,          label: 'Simulador' },
]

const navClass = (isActive: boolean) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
    isActive
      ? 'bg-white/12 text-white shadow-sm'
      : 'text-sidebar-text hover:bg-white/6 hover:text-white'
  }`

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold text-white/30 px-3 mb-1.5 mt-1 uppercase tracking-[0.12em]">
    {children}
  </p>
)

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const location = useLocation()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    toast.success('Sesión cerrada')
  }

  const searchParams = new URLSearchParams(location.search)
  const activePage = searchParams.get('page') ?? 'carga'
  const inWalt = location.pathname === '/planificacion'

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #000E28 0%, #001540 40%, #001E52 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <img
          src="/logo.jpg"
          alt="Logo"
          className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-md"
        />
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight tracking-tight">Gestión de Nómina</p>
          <p className="text-white/40 text-[11px] mt-0.5 font-medium">Proyecto Walt</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-thin">
        <div>
          <SectionLabel>Principal</SectionLabel>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => navClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                    <Icon size={15} />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-4">
            <SectionLabel>Administración</SectionLabel>
            {ADMIN_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => navClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Walt section */}
        <div className="mt-4">
          <SectionLabel>Walt · Planificación</SectionLabel>
          {WALT_ITEMS.map(({ page, icon: Icon, label }) => {
            const isActive = inWalt && activePage === page
            return (
              <NavLink
                key={page}
                to={`/planificacion?page=${page}`}
                className={navClass(isActive)}
              >
                {() => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Programación section */}
        <div className="mt-4">
          <SectionLabel>Programación</SectionLabel>
          {PROGRAMACION_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => navClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                    <Icon size={15} />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/8 p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/6 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-konecta/80 ring-2 ring-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{user?.nombre}</p>
            <p className="text-white/40 text-[11px] truncate mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
        {isAdmin && (
          <div className="mt-1.5 px-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-konecta-light/80">
              <Shield size={10} /> Administrador
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
