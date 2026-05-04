import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SoporteWidget from '../ui/SoporteWidget'
import { useSidebarStore } from '../../store/sidebar'

export default function Layout() {
  const { collapsed } = useSidebarStore()
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}
      >
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <SoporteWidget />
    </div>
  )
}
