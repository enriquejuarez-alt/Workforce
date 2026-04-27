import { Bell, Search } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const user = useAuthStore((s) => s.user)

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-800">{user?.nombre}</p>
            <p className="text-xs text-gray-500">
              {user?.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Supervisor'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-konecta flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
