import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CommandBar from './CommandBar'
import SoporteWidget from '../ui/SoporteWidget'
import CommandPalette from '../ui/CommandPalette'
import { useSidebarStore } from '../../store/sidebar'
import { usePaletteStore } from '../../store/palette'
import { useAuthStore } from '../../store/auth'

export default function Layout() {
  const { collapsed } = useSidebarStore()
  const { toggle: togglePalette } = usePaletteStore()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.rol === 'ADMINISTRADOR'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePalette])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}
      >
        <CommandBar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
      <SoporteWidget />
      <CommandPalette isAdmin={isAdmin} />
    </div>
  )
}
