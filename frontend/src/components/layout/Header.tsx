import { useAuthStore } from '../../store/auth'
import NotificationBell from '../ui/NotificationBell'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const user = useAuthStore((s) => s.user)

  return (
    <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200/80 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
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
