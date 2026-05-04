import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, FileSpreadsheet, ClipboardList, CalendarDays,
  ArrowLeftRight, UserMinus, FilePen, GraduationCap, UserX, Palmtree,
  GitCompare, Upload, History, Users, Building2, Activity,
  UploadCloud, BarChart3, TrendingUp, Sliders, CalendarClock, Shuffle,
} from 'lucide-react'
import { usePaletteStore } from '../../store/palette'

interface Command {
  to: string
  label: string
  section: string
  icon: React.ElementType
  adminOnly?: boolean
}

const ALL_COMMANDS: Command[] = [
  { to: '/dashboard',        label: 'Dashboard',           section: 'Principal',           icon: LayoutDashboard },
  { to: '/nomina',           label: 'Nómina',              section: 'Principal',           icon: FileSpreadsheet },
  { to: '/licencias',        label: 'Licencias',           section: 'Principal',           icon: ClipboardList },
  { to: '/calendario',       label: 'Calendario',          section: 'Principal',           icon: CalendarDays },
  { to: '/cambios',          label: 'Cambios Temporales',  section: 'Principal',           icon: ArrowLeftRight },
  { to: '/bajas',            label: 'Bajas',               section: 'Principal',           icon: UserMinus },
  { to: '/cambios-contrato', label: 'Cambios de Contrato', section: 'Principal',           icon: FilePen },
  { to: '/capacitaciones',   label: 'Capacitaciones',      section: 'Principal',           icon: GraduationCap },
  { to: '/remociones',       label: 'Remociones',          section: 'Principal',           icon: UserX },
  { to: '/vacaciones',       label: 'Vacaciones',          section: 'Principal',           icon: Palmtree },
  { to: '/comparacion',      label: 'Comparar Nóminas',    section: 'Principal',           icon: GitCompare },
  { to: '/programacion',     label: 'Programación',        section: 'Programación',        icon: CalendarClock },
  { to: '/distribucion',     label: 'Distribución',        section: 'Programación',        icon: Shuffle },
  { to: '/planificacion?page=carga',     label: 'Planif. · Carga de archivos', section: 'Walt', icon: UploadCloud },
  { to: '/planificacion?page=dashboard', label: 'Planif. · Resumen',           section: 'Walt', icon: BarChart3 },
  { to: '/planificacion?page=analisis',  label: 'Planif. · Análisis',          section: 'Walt', icon: TrendingUp },
  { to: '/planificacion?page=curvas',    label: 'Planif. · Curvas',            section: 'Walt', icon: TrendingUp },
  { to: '/planificacion?page=simulador', label: 'Planif. · Simulador',         section: 'Walt', icon: Sliders },
  { to: '/carga',        label: 'Carga de Nómina',        section: 'Administración', icon: Upload,   adminOnly: true },
  { to: '/importaciones', label: 'Historial Importaciones', section: 'Administración', icon: History,  adminOnly: true },
  { to: '/usuarios',     label: 'Usuarios',               section: 'Administración', icon: Users,    adminOnly: true },
  { to: '/servicios',    label: 'Servicios',              section: 'Administración', icon: Building2, adminOnly: true },
  { to: '/auditoria',    label: 'Auditoría',              section: 'Administración', icon: Activity, adminOnly: true },
]

interface Props {
  isAdmin?: boolean
}

export default function CommandPalette({ isAdmin = false }: Props) {
  const { isOpen, close } = usePaletteStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo(
    () => ALL_COMMANDS.filter((c) => !c.adminOnly || isAdmin),
    [isAdmin],
  )

  const results = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q),
    )
  }, [query, commands])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [isOpen])

  useEffect(() => { setSelectedIdx(0) }, [results])

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[selectedIdx]) { navigate(results[selectedIdx].to); close() }
    else if (e.key === 'Escape') close()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar página o sección..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-mono shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Sin resultados para "{query}"</p>
          ) : (
            results.map((cmd, i) => {
              const Icon = cmd.icon
              const active = i === selectedIdx
              return (
                <button
                  key={cmd.to + i}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-konecta/5' : 'hover:bg-gray-50'}`}
                  onClick={() => { navigate(cmd.to); close() }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-konecta/10 text-konecta' : 'bg-gray-100 text-gray-500'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${active ? 'text-konecta' : 'text-gray-700'}`}>{cmd.label}</p>
                    <p className="text-xs text-gray-400">{cmd.section}</p>
                  </div>
                  {active && (
                    <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-mono shrink-0">↵</kbd>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded font-mono mr-1">↑↓</kbd>navegar</span>
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded font-mono mr-1">↵</kbd>abrir</span>
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded font-mono mr-1">Esc</kbd>cerrar</span>
          <span className="ml-auto">{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
