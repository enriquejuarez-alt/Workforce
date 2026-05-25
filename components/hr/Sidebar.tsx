"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, FileSpreadsheet, Upload,
  ClipboardList, ArrowLeftRight, Shield, GitCompare,
  LogOut, Activity, History, UserMinus, GraduationCap, Palmtree,
  CalendarDays, Sliders, TrendingUp, UploadCloud, CalendarClock, Shuffle,
  PanelLeftClose, PanelLeftOpen, TrendingDown, GitCommitVertical, FilePen,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useSidebarStore } from '@/store/sidebar'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { canAccess, isAdminRole, ROL_LABELS } from '@/lib/utils/roles'
import type { Rol } from '@/types'

const NAV_ITEMS = [
  { to: '/dashboard',        icon: LayoutDashboard,   label: 'Dashboard' },
  { to: '/nomina',           icon: FileSpreadsheet,   label: 'Nómina' },
  { to: '/licencias',        icon: ClipboardList,     label: 'Licencias' },
  { to: '/calendario',       icon: CalendarDays,      label: 'Calendario' },
  { to: '/cambios',          icon: ArrowLeftRight,    label: 'Cambios' },
  { to: '/bajas',            icon: UserMinus,         label: 'Bajas y Remociones' },
  { to: '/capacitaciones',   icon: GraduationCap,     label: 'Formador' },
  { to: '/vacaciones',       icon: Palmtree,          label: 'Vacaciones' },
  { to: '/comparacion',      icon: GitCompare,        label: 'Comparar Nóminas' },
  { to: '/ausentismo',       icon: TrendingDown,      label: 'Ausentismo' },
  { to: '/historial-agente', icon: GitCommitVertical, label: 'Historial Agente' },
]

const PROGRAMACION_ITEMS = [
  { to: '/programacion', icon: CalendarClock, label: 'Programación' },
  { to: '/distribucion', icon: Shuffle,       label: 'Distribución' },
]

const ADMIN_ITEMS = [
  { to: '/carga',         icon: Upload,    label: 'Carga de Nómina' },
  { to: '/importaciones', icon: History,   label: 'Historial Importaciones' },
  { to: '/usuarios',      icon: Users,     label: 'Usuarios' },
  { to: '/servicios',     icon: Building2, label: 'Servicios' },
  { to: '/auditoria',     icon: Activity,  label: 'Auditoría' },
]

const WALT_ITEMS = [
  { to: '/planificacion',             icon: UploadCloud,     label: 'Carga de archivos' },
  { to: '/planificacion/resumen',     icon: LayoutDashboard, label: 'Resumen' },
  { to: '/planificacion/curvas',      icon: TrendingUp,      label: 'Curvas' },
  { to: '/planificacion/simulador',   icon: Sliders,         label: 'Simulador' },
  { to: '/planificacion/contratos',    icon: FilePen,         label: 'Contratos' },
]

const navItemBase = (collapsed: boolean) =>
  `flex items-center gap-[11px] rounded-[7px] text-sm font-medium transition-all duration-200 mb-0.5 ${
    collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2'
  }`

const navActiveStyle = {
  background: 'rgba(255,255,255,0.14)',
  color: '#FFFFFF',
  boxShadow: 'inset 2px 0 0 #7AB0FF',
}

const SectionLabel = ({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) =>
  collapsed ? (
    <div className="h-px mx-2 my-2" style={{ background: 'rgba(255,255,255,0.10)' }} />
  ) : (
    <p
      className="px-3 mb-1.5 mt-1 uppercase"
      style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.40)' }}
    >
      {children}
    </p>
  )

function NavItem({ to, icon: Icon, label, collapsed }: {
  to: string; icon: React.ElementType; label: string; collapsed: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === to || (to !== '/' && pathname.startsWith(to + '/'))

  return (
    <Link
      href={to}
      title={collapsed ? label : undefined}
      className={navItemBase(collapsed) + (isActive ? '' : ' hover:bg-white/6')}
      style={isActive ? navActiveStyle : undefined}
    >
      <span
        className="shrink-0 transition-colors"
        style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      {!collapsed && (
        <span
          className="flex-1 truncate"
          style={{ color: isActive ? '#FFFFFF' : '#B6CDEF' }}
        >
          {label}
        </span>
      )}
      {!collapsed && isActive && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor: '#7AB0FF',
            boxShadow: '0 0 10px #7AB0FF',
          }}
        />
      )}
    </Link>
  )
}

export default function HrSidebar() {
  const { user, clearAuth } = useAuthStore()
  const { collapsed, toggle } = useSidebarStore()
  const pathname = usePathname()
  const rol = user?.rol as Rol | undefined

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    toast.success('Sesión cerrada')
  }

  const visibleNav = NAV_ITEMS.filter(({ to }) => canAccess(rol, to))
  const showProgramacion = PROGRAMACION_ITEMS.some(({ to }) => canAccess(rol, to))
  const showWalt = canAccess(rol, '/planificacion')
  const showAdmin = isAdminRole(rol)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{
        background: 'linear-gradient(165deg, #001A4D 0%, #002B7A 50%, #0040A8 100%)',
      }}
    >
      {/* Radial glow — top-right corner */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -80,
          top: -80,
          width: 240,
          height: 240,
          background: 'radial-gradient(circle, rgba(122,176,255,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Logo + toggle */}
      <div
        className={`relative z-10 flex items-center shrink-0 ${collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4 gap-3'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        <img
          src="/logo-mark.png"
          alt="Logo"
          className="shrink-0 object-cover"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            boxShadow: '0 6px 16px -4px rgba(0,0,0,0.40)',
            backgroundColor: '#0054A6',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/logo.jpg'
          }}
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 19, color: '#FFFFFF', lineHeight: 1.1 }}>
              Nómina
            </p>
            <p style={{ fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              Proyecto Walt
            </p>
          </div>
        )}
        <button
          onClick={toggle}
          className="rounded-lg p-1 transition-colors shrink-0"
          style={{ color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-3 px-2">
        {visibleNav.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>Principal</SectionLabel>
            {visibleNav.map(({ to, icon, label }) => (
              <NavItem key={to} to={to} icon={icon} label={label} collapsed={collapsed} />
            ))}
          </div>
        )}

        {showAdmin && (
          <div className="mt-2">
            <SectionLabel collapsed={collapsed}>Administración</SectionLabel>
            {ADMIN_ITEMS.map(({ to, icon, label }) => (
              <NavItem key={to} to={to} icon={icon} label={label} collapsed={collapsed} />
            ))}
          </div>
        )}

        {showWalt && (
          <div className="mt-2">
            <SectionLabel collapsed={collapsed}>Planificación</SectionLabel>
            {WALT_ITEMS.map(({ to, icon: Icon, label }) => {
              const isActive = pathname === to || (to !== '/planificacion' && pathname.startsWith(to))
              return (
                <Link
                  key={to}
                  href={to}
                  className={navItemBase(collapsed) + (isActive ? '' : ' hover:bg-white/6')}
                  style={isActive ? navActiveStyle : undefined}
                  title={collapsed ? label : undefined}
                >
                  <span
                    className="shrink-0 transition-colors"
                    style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                  >
                    <Icon size={14} strokeWidth={2} />
                  </span>
                  {!collapsed && (
                    <span
                      className="flex-1 truncate"
                      style={{ color: isActive ? '#FFFFFF' : '#B6CDEF' }}
                    >
                      {label}
                    </span>
                  )}
                  {!collapsed && isActive && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#7AB0FF', boxShadow: '0 0 10px #7AB0FF' }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {showProgramacion && (
          <div className="mt-2">
            <SectionLabel collapsed={collapsed}>Programación</SectionLabel>
            {PROGRAMACION_ITEMS.map(({ to, icon, label }) => (
              <NavItem key={to} to={to} icon={icon} label={label} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div
        className="relative z-10 p-3 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div
          className={`flex items-center rounded-lg transition-colors cursor-default ${collapsed ? 'justify-center px-1 py-2' : 'gap-2.5 px-2 py-2'}`}
          style={{ color: '#B6CDEF' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0054A6, #1A6EC2)',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.10), 0 4px 10px -2px rgba(0,0,0,0.30)',
            }}
            title={collapsed ? (user?.nombre ?? '') : undefined}
          >
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate leading-tight">{user?.nombre}</p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.40)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FCA5A5')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
                title="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>

        {!collapsed && rol && (
          <div className="mt-1.5 px-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'rgba(122,176,255,0.80)' }}>
              <Shield size={10} /> {ROL_LABELS[rol]}
            </span>
            {user?.servicio?.nombre && (
              <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.30)' }}>· {user.servicio.nombre}</span>
            )}
          </div>
        )}

        {collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center mt-1 p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.30)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FCA5A5')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
