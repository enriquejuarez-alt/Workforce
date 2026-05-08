import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, UserCheck, UserX, FileSpreadsheet, Upload,
  ArrowLeftRight, Clock, CheckCircle, Building2, CalendarDays, Palmtree,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dashboardApi, serviciosApi } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import KpiCard from '../components/ui/KpiCard'
import { SkeletonDashboard } from '../components/ui/Skeleton'
import { MESES } from '../types'
import { useAuthStore } from '../store/auth'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [selectedServicioId, setSelectedServicioId] = useState<number | ''>('')

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', selectedServicioId],
    queryFn: () => dashboardApi.get(selectedServicioId ? { servicio_id: selectedServicioId } : undefined).then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Cargando..." />
      <SkeletonDashboard />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Selector de servicio */}
        <div className="flex items-center gap-3">
          <Building2 size={16} className="text-gray-400 shrink-0" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedServicioId('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selectedServicioId === '' ? 'bg-konecta text-white border-konecta' : 'bg-white text-gray-600 border-gray-200 hover:border-konecta hover:text-konecta'}`}
            >
              Todos
            </button>
            {(servicios as any[]).filter((s) => s.activo).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServicioId(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selectedServicioId === s.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'}`}
                style={selectedServicioId === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs principales */}
        <div>
          <p className="section-title mb-3">
            Resumen de agentes — mes corriente
            {selectedServicioId !== '' && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                · {(servicios as any[]).find((s) => s.id === selectedServicioId)?.nombre}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total en nómina" value={data?.total_agentes ?? 0} icon={Users} color="blue" />
            <KpiCard title="Activos" value={data?.agentes_activos ?? 0} icon={UserCheck} color="green"
              subtitle="Estado ACTIVO en nómina" />
            <KpiCard title="Licencia" value={data?.agentes_lp ?? 0} icon={Clock} color="yellow"
              subtitle="Con licencia vigente hoy" />
            <KpiCard title="Dados de baja" value={data?.agentes_inactivos ?? 0} icon={UserX} color="red"
              subtitle="Desactivados del sistema" />
          </div>
        </div>

        {/* Breakdown por estado */}
        {data?.estado_breakdown && data.estado_breakdown.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Distribución por estado (nómina mes corriente)</p>
            <div className="flex flex-wrap gap-2">
              {data.estado_breakdown
                .sort((a: any, b: any) => b.cantidad - a.cantidad)
                .map((e: any) => (
                  <div key={e.estado} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-bold text-gray-800">{e.cantidad}</span>
                    <span className="text-xs text-gray-500">{e.estado || 'Sin estado'}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* KPIs operativos */}
        <div>
          <p className="section-title mb-3">Estado operativo</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Licencias vigentes" value={data?.licencias_vigentes ?? 0} icon={Clock} color="yellow" />
            <KpiCard title="Licencias programadas" value={data?.licencias_programadas ?? 0} icon={Clock} color="blue" />
            <KpiCard title="Vacaciones en el mes" value={data?.vacaciones_mes?.length ?? 0} icon={Palmtree} color="purple"
              subtitle="Mes corriente" />
            <KpiCard title="Cambios temporales" value={data?.cambios_activos ?? 0} icon={ArrowLeftRight} color="blue" />
            <KpiCard title="Nóminas activas" value={data?.nominas_activas ?? 0} icon={CheckCircle} color="green"
              subtitle="Mes corriente" />
          </div>
        </div>

        {/* Última carga + Por servicio */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Última carga */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Upload size={16} className="text-konecta" />
              <p className="text-sm font-bold text-gray-700">Última importación</p>
            </div>
            {data?.ultima_carga ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">{data.ultima_carga.nomina_mensual?.servicio?.nombre}</p>
                <p className="text-xs text-gray-500">
                  {MESES[(data.ultima_carga.nomina_mensual?.mes ?? 1) - 1]} {data.ultima_carga.nomina_mensual?.anio}
                </p>
                <p className="text-xs text-gray-500">{data.ultima_carga.archivo_nombre}</p>
                <div className="pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{data.ultima_carga.total_filas}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{data.ultima_carga.agentes_creados}</p>
                    <p className="text-xs text-gray-500">Nuevos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{data.ultima_carga.agentes_actualizados}</p>
                    <p className="text-xs text-gray-500">Actualizados</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {format(new Date(data.ultima_carga.fecha_importacion), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin importaciones registradas</p>
            )}
          </div>

          {/* Por servicio */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-konecta" />
              <p className="text-sm font-bold text-gray-700">Agentes por servicio</p>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const max = Math.max(...(data?.por_servicio?.map((x) => x.total_agentes) ?? [0]), 1)
                return data?.por_servicio?.map((s) => {
                  const pct = (s.total_agentes / max) * 100
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-xs font-medium text-gray-700">{s.nombre}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-600">{s.total_agentes}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                  )
                })
              })()}
              {!data?.por_servicio?.length && (
                <p className="text-sm text-gray-400">Sin datos de servicios</p>
              )}
            </div>
          </div>
        </div>

        {/* Vacaciones del mes */}
        {(data?.vacaciones_mes?.length ?? 0) > 0 && (
          <div>
            <p className="section-title mb-3">De vacaciones este mes</p>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Palmtree size={16} className="text-purple-500" />
                <p className="text-sm font-bold text-gray-700">Agentes con vacaciones en el mes corriente</p>
                <span className="ml-auto text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  {data!.vacaciones_mes.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data!.vacaciones_mes.map((v, i) => (
                  <button
                    key={v.agente_id ?? `${v.agente_dni}-${i}`}
                    onClick={() => v.agente_id ? navigate(`/nomina/agente/${v.agente_id}`) : undefined}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors text-left group border border-gray-100 ${v.agente_id ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                      style={{ backgroundColor: v.servicio_color || '#8b5cf6' }}
                    >
                      {v.agente_nombre.trim().split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-konecta transition-colors">
                        {v.agente_nombre}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {v.servicio_nombre ?? v.agente_dni ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-purple-500 font-semibold">
                        {format(new Date(v.fecha_desde + 'T12:00:00'), 'dd/MM')} → {format(new Date(v.fecha_hasta + 'T12:00:00'), 'dd/MM')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {user?.rol === 'ADMINISTRADOR' && data?.usuarios_activos !== null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Usuarios activos" value={data?.usuarios_activos ?? 0} icon={Users} color="purple" />
            <KpiCard title="Nóminas cerradas" value={data?.nominas_cerradas ?? 0} icon={FileSpreadsheet} color="gray" />
          </div>
        )}

        {/* Ausentes hoy */}
        {(data?.licencias_hoy?.length ?? 0) > 0 && (
          <div>
            <p className="section-title mb-3">Ausentes hoy</p>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={16} className="text-yellow-500" />
                <p className="text-sm font-bold text-gray-700">Agentes con licencia vigente</p>
                <span className="ml-auto text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200">
                  {data!.licencias_hoy.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data!.licencias_hoy.map((a) => (
                  <button
                    key={a.agente_id}
                    onClick={() => navigate(`/nomina/agente/${a.agente_id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left group border border-gray-100"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                      style={{ backgroundColor: a.servicio_color || '#6366f1' }}
                    >
                      {a.agente_nombre.trim().split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-konecta transition-colors">
                        {a.agente_nombre}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {a.servicio_nombre ?? '—'}
                        {a.motivo ? ` · ${a.motivo}` : ''}
                      </p>
                    </div>
                    <p className="text-[10px] text-red-400 font-semibold shrink-0">
                      hasta {format(new Date(a.fecha_hasta + 'T12:00:00'), 'dd/MM')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
