"use client"

import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { usePaletteStore } from '@/store/palette'
import NotificationBell from '@/components/hr/ui/NotificationBell'

interface HeaderProps {
  title: string
  titleAccent?: string
  subtitle?: string
  actions?: React.ReactNode
}

const SECTION_MAP: Record<string, string> = {
  '/dashboard':        'Principal · Dashboard',
  '/nomina':           'Principal · Nómina',
  '/licencias':        'Principal · Licencias',
  '/calendario':       'Principal · Calendario',
  '/cambios':          'Principal · Cambios',
  '/bajas':            'Principal · Bajas',
  '/cambios-contrato': 'Principal · Cambios de contrato',
  '/capacitaciones':   'Principal · Formador',
  '/remociones':       'Principal · Remociones',
  '/vacaciones':       'Principal · Vacaciones',
  '/comparacion':      'Principal · Comparar',
  '/ausentismo':       'Principal · Ausentismo',
  '/historial-agente': 'Principal · Historial',
  '/carga':            'Administración · Carga',
  '/importaciones':    'Administración · Importaciones',
  '/usuarios':         'Administración · Usuarios',
  '/servicios':        'Administración · Servicios',
  '/auditoria':        'Administración · Auditoría',
  '/soporte':          'Soporte',
  '/planificacion':    'Walt · Planificación',
  '/programacion':     'Programación',
  '/distribucion':     'Programación · Distribución',
}

export default function Header({ title, titleAccent, subtitle, actions }: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const { open: openPalette } = usePaletteStore()
  const pathname = usePathname()

  const segment = '/' + pathname.split('/')[1]
  const section = SECTION_MAP[segment]

  return (
    <header
      className="flex items-center justify-between px-8 shrink-0 sticky top-0 z-10 bg-white"
      style={{
        height: 76,
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <div>
        {section && (
          <p
            className="uppercase mb-1"
            style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', color: '#6B7280' }}
          >
            {section}
          </p>
        )}
        <h1 className="page-title leading-none">
          {title}
          {titleAccent && <em> {titleAccent}</em>}
        </h1>
        {subtitle && (
          <p className="mt-0.5 font-medium" style={{ fontSize: 11.5, color: '#6B7280' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid #E5E7EB' }}>
          <button
            onClick={openPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Buscar (Ctrl+K)"
          >
            <Search size={12} />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden sm:inline text-[10px] bg-white border border-gray-200 px-1 py-0.5 rounded font-mono">⌃K</kbd>
          </button>
          <NotificationBell />
          <div className="flex items-center gap-2.5 pl-2" style={{ borderLeft: '1px solid #F1F4F8' }}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.nombre}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {user?.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Supervisor'}
              </p>
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0054A6, #1A6EC2)',
              }}
            >
              <span className="text-white text-xs font-bold">
                {user?.nombre?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
