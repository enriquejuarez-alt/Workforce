import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { usePaletteStore } from '../../store/palette'
import NotificationBell from '../ui/NotificationBell'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

const SECTION_MAP: Record<string, string> = {
  '/dashboard':        'Principal',
  '/nomina':           'Principal',
  '/licencias':        'Principal',
  '/calendario':       'Principal',
  '/cambios':          'Principal',
  '/bajas':            'Principal',
  '/cambios-contrato': 'Principal',
  '/capacitaciones':   'Principal',
  '/remociones':       'Principal',
  '/vacaciones':       'Principal',
  '/comparacion':      'Principal',
  '/carga':            'Administración',
  '/importaciones':    'Administración',
  '/usuarios':         'Administración',
  '/servicios':        'Administración',
  '/auditoria':        'Administración',
  '/soporte':          'Soporte',
  '/planificacion':    'Walt · Planificación',
  '/programacion':     'Programación',
  '/distribucion':     'Programación',
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const { open: openPalette } = usePaletteStore()
  const location = useLocation()

  const segment = '/' + location.pathname.split('/')[1]
  const section = SECTION_MAP[segment]

  return (
    <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200/80 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <div>
        {section && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
            {section}
          </p>
        )}
        <h1 className="page-title leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
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
          <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.nombre}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {user?.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Supervisor'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-konecta flex items-center justify-center ring-2 ring-konecta/20">
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
