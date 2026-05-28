"use client"

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  LayoutDashboard, FileSpreadsheet, ClipboardList, CalendarDays,
  ArrowLeftRight, UserMinus, GraduationCap, Palmtree, GitCompare,
  TrendingDown, GitCommitVertical, UploadCloud, CalendarClock, Shuffle,
  HelpCircle, RotateCcw, Save, Shield, CheckCircle,
} from 'lucide-react'
import { configuracionApi } from '@/lib/api'
import { useConfigStore, DEFAULT_ROL_PATHS } from '@/store/config'
import Header from '@/components/hr/layout/Header'
import toast from 'react-hot-toast'

const SECTIONS = [
  { path: '/dashboard',        label: 'Dashboard',           icon: LayoutDashboard },
  { path: '/nomina',           label: 'Nómina',              icon: FileSpreadsheet },
  { path: '/licencias',        label: 'Licencias',           icon: ClipboardList },
  { path: '/calendario',       label: 'Calendario',          icon: CalendarDays },
  { path: '/cambios',          label: 'Cambios',             icon: ArrowLeftRight },
  { path: '/bajas',            label: 'Bajas y Remociones',  icon: UserMinus },
  { path: '/capacitaciones',   label: 'Formador',            icon: GraduationCap },
  { path: '/vacaciones',       label: 'Vacaciones',          icon: Palmtree },
  { path: '/comparacion',      label: 'Comparar Nóminas',    icon: GitCompare },
  { path: '/ausentismo',       label: 'Ausentismo',          icon: TrendingDown },
  { path: '/historial-agente', label: 'Historial Agente',    icon: GitCommitVertical },
  { path: '/planificacion',    label: 'Planificación (Walt)', icon: UploadCloud },
  { path: '/programacion',     label: 'Programación',        icon: CalendarClock },
  { path: '/distribucion',     label: 'Distribución',        icon: Shuffle },
  { path: '/soporte',          label: 'Soporte',             icon: HelpCircle },
]

const ROLES = [
  { rol: 'WORKFORCE',   label: 'Workforce',   color: '#3B82F6' },
  { rol: 'LIDER',       label: 'Líder',       color: '#10B981' },
  { rol: 'CAPACITADOR', label: 'Capacitador', color: '#F59E0B' },
] as const

type ConfigState = Record<string, Set<string>>

function fromArrays(data: Record<string, string[]>): ConfigState {
  const out: ConfigState = {}
  for (const rol of ROLES.map(r => r.rol)) {
    out[rol] = new Set(data[rol] ?? [])
  }
  return out
}

function toArrays(state: ConfigState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [rol, set] of Object.entries(state)) {
    out[rol] = [...set]
  }
  return out
}

export default function ConfiguracionPage() {
  const { rolPaths, setRolPaths } = useConfigStore()
  const [config, setConfig] = useState<ConfigState>(() => fromArrays(rolPaths))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setConfig(fromArrays(rolPaths))
    setDirty(false)
  }, [rolPaths])

  const saveMut = useMutation({
    mutationFn: () => configuracionApi.updateRolConfig(toArrays(config)),
    onSuccess: () => {
      setRolPaths(toArrays(config))
      setDirty(false)
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const resetMut = useMutation({
    mutationFn: async () => {
      for (const { rol } of ROLES) {
        await configuracionApi.resetRol(rol)
      }
    },
    onSuccess: async () => {
      const fresh = await configuracionApi.getRolConfig()
      setRolPaths(fresh.data)
      setConfig(fromArrays(fresh.data))
      setDirty(false)
      toast.success('Configuración restablecida a valores por defecto')
    },
    onError: () => toast.error('Error al restablecer'),
  })

  function toggle(rol: string, path: string) {
    setConfig(prev => {
      const next = { ...prev, [rol]: new Set(prev[rol]) }
      if (next[rol].has(path)) next[rol].delete(path)
      else next[rol].add(path)
      return next
    })
    setDirty(true)
  }

  function toggleAll(path: string) {
    const allOn = ROLES.every(r => config[r.rol]?.has(path))
    setConfig(prev => {
      const next = { ...prev }
      for (const { rol } of ROLES) {
        next[rol] = new Set(prev[rol])
        if (allOn) next[rol].delete(path)
        else next[rol].add(path)
      }
      return next
    })
    setDirty(true)
  }

  function toggleRole(rol: string) {
    const allOn = SECTIONS.every(s => config[rol]?.has(s.path))
    setConfig(prev => {
      const next = { ...prev, [rol]: new Set<string>() }
      if (!allOn) SECTIONS.forEach(s => next[rol].add(s.path))
      return next
    })
    setDirty(true)
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Configuración"
        subtitle="Acceso por rol"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending || saveMut.isPending}
              title="Restablecer valores por defecto"
            >
              <RotateCcw size={14} /> Restablecer
            </button>
            <button
              className="btn-primary"
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
            >
              <Save size={14} />
              {saveMut.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <Shield size={15} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Administrador</span> siempre tiene acceso total y no se puede restringir.
            Las secciones de administración (Carga de Nómina, Usuarios, Servicios, Auditoría) son siempre exclusivas del Administrador.
          </div>
        </div>

        {/* Grilla */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-900 text-white text-left px-5 py-4 font-semibold text-[11px] uppercase tracking-widest border-r border-gray-700" style={{ minWidth: 220 }}>
                    Sección
                  </th>
                  <th className="bg-gray-800 text-white px-4 py-4 text-center border-r border-gray-700 font-semibold text-[11px] uppercase tracking-widest" style={{ minWidth: 80 }}>
                    Todos
                  </th>
                  {ROLES.map(({ rol, label, color }) => (
                    <th key={rol} className="bg-gray-900 text-white px-4 py-4 text-center border-r border-gray-700 last:border-r-0" style={{ minWidth: 120 }}>
                      <div className="flex flex-col items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{ backgroundColor: color + '22', color }}
                        >
                          {label}
                        </span>
                        <button
                          onClick={() => toggleRole(rol)}
                          className="text-[10px] text-gray-400 hover:text-white transition-colors font-medium"
                        >
                          {SECTIONS.every(s => config[rol]?.has(s.path)) ? 'Desmarcar todo' : 'Marcar todo'}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((section, i) => {
                  const Icon = section.icon
                  const allOn = ROLES.every(r => config[r.rol]?.has(section.path))
                  const someOn = ROLES.some(r => config[r.rol]?.has(section.path))
                  return (
                    <tr
                      key={section.path}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-5 py-3.5 border-r border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <Icon size={13} className="text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-800">{section.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center border-r border-gray-100">
                        <button
                          onClick={() => toggleAll(section.path)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all border ${
                            allOn
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : someOn
                                ? 'bg-blue-50 border-blue-200 text-blue-400'
                                : 'bg-gray-50 border-gray-200 text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          <CheckCircle size={14} />
                        </button>
                      </td>
                      {ROLES.map(({ rol, color }) => {
                        const enabled = config[rol]?.has(section.path) ?? false
                        return (
                          <td key={rol} className="px-4 py-3.5 text-center border-r border-gray-100 last:border-r-0">
                            <button
                              onClick={() => toggle(rol, section.path)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none ${
                                enabled ? 'shadow-sm' : 'bg-gray-200'
                              }`}
                              style={enabled ? { backgroundColor: color } : undefined}
                              role="switch"
                              aria-checked={enabled}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                                  enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen por rol */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map(({ rol, label, color }) => {
            const count = SECTIONS.filter(s => config[rol]?.has(s.path)).length
            const pct = Math.round((count / SECTIONS.length) * 100)
            return (
              <div key={rol} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
                  <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                </div>
                <p className="text-3xl font-black text-gray-900 mb-1">{count}</p>
                <p className="text-xs text-gray-400">de {SECTIONS.length} secciones</p>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {dirty && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm rounded-2xl px-5 py-3.5 shadow-2xl border border-gray-700">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Hay cambios sin guardar
            <button
              className="ml-2 bg-white text-gray-900 font-bold text-xs px-4 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
