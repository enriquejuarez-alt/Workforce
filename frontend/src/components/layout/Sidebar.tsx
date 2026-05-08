import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, FileSpreadsheet, Upload,
  ClipboardList, ArrowLeftRight, Shield, GitCompare,
  LogOut, Activity, History, UserMinus, GraduationCap, Palmtree,
  CalendarDays, Sliders, TrendingUp, UploadCloud, CalendarClock, Shuffle,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useSidebarStore } from '../../store/sidebar'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/nomina', icon: FileSpreadsheet, label: 'Nómina' },
  { to: '/licencias', icon: ClipboardList, label: 'Licencias' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
  { to: '/cambios', icon: ArrowLeftRight, label: 'Cambios' },
  { to: '/bajas', icon: UserMinus, label: 'Bajas y Remociones' },
  { to: '/capacitaciones', icon: GraduationCap, label: 'Formador' },
  { to: '/vacaciones', icon: Palmtree, label: 'Vacaciones' },
  { to: '/comparacion', icon: GitCompare, label: 'Comparar Nóminas' },
]

const PROGRAMACION_ITEMS = [
  { to: '/programacion', icon: CalendarClock, label: 'Programación' },
  { to: '/distribucion', icon: Shuffle, label: 'Distribución' },
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
  { page: 'curvas',      icon: TrendingUp,       label: 'Curvas' },
  { page: 'simulador',   icon: Sliders,          label: 'Simulador' },
]

const navClass = (isActive: boolean, collapsed: boolean) =>
  `flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
    collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2'
  } ${
    isActive
      ? 'bg-white/12 text-white shadow-sm'
      : 'text-sidebar-text hover:bg-white/6 hover:text-white'
  }`

const SectionLabel = ({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) =>
  collapsed ? (
    <div className="h-px bg-white/10 mx-2 my-2" />
  ) : (
    <p className="text-[10px] font-bold text-white/30 px-3 mb-1.5 mt-1 uppercase tracking-[0.12em]">
      {children}
    </p>
  )

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const { collapsed, toggle } = useSidebarStore()
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
      className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ background: 'linear-gradient(160deg, #000E28 0%, #001540 40%, #001E52 100%)' }}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center border-b border-white/8 shrink-0 ${collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4 gap-3'}`}>
        <img
          src="/logo.jpg"
          alt="Logo"
          className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-md"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm leading-tight tracking-tight">Gestión de Nómina</p>
            <p className="text-white/40 text-[11px] mt-0.5 font-medium">Proyecto Walt</p>
          </div>
        )}
        <button
          onClick={toggle}
          className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/8 shrink-0"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        <div>
          <SectionLabel collapsed={collapsed}>Principal</SectionLabel>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => navClass(isActive, collapsed)}
              title={collapsed ? label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                    <Icon size={15} />
                  </span>
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-2">
            <SectionLabel collapsed={collapsed}>Administración</SectionLabel>
            {ADMIN_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => navClass(isActive, collapsed)}
                title={collapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                      <Icon size={15} />
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                    {!collapsed && isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Walt section */}
        <div className="mt-2">
          <SectionLabel collapsed={collapsed}>Planificación</SectionLabel>
          {WALT_ITEMS.map(({ page, icon: Icon, label }) => {
            const isActive = inWalt && activePage === page
            return (
              <NavLink
                key={page}
                to={`/planificacion?page=${page}`}
                className={navClass(isActive, collapsed)}
                title={collapsed ? label : undefined}
              >
                {() => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                      <Icon size={15} />
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                    {!collapsed && isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-konecta-light shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Programación section */}
        <div className="mt-2">
          <SectionLabel collapsed={collapsed}>Programación</SectionLabel>
          {PROGRAMACION_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => navClass(isActive, collapsed)}
              title={collapsed ? label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
                    <Icon size={15} />
                  </span>
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && isActive && (
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
        <div className={`flex items-center rounded-lg hover:bg-white/6 transition-colors cursor-default ${collapsed ? 'justify-center px-1 py-2' : 'gap-2.5 px-2 py-2'}`}>
          <div
            className="w-8 h-8 rounded-full bg-konecta/80 ring-2 ring-white/10 flex items-center justify-center shrink-0"
            title={collapsed ? (user?.nombre ?? '') : undefined}
          >
            <span className="text-white text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </div>
        {!collapsed && isAdmin && (
          <div className="mt-1.5 px-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-konecta-light/80">
              <Shield size={10} /> Administrador
            </span>
          </div>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center mt-1 text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
