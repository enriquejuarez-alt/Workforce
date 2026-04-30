import { useQuery } from '@tanstack/react-query'
import {
  Users, UserCheck, UserX, FileSpreadsheet, Upload,
  ArrowLeftRight, AlertCircle, Clock, CheckCircle, Building2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dashboardApi } from '../lib/api'
import Header from '../components/layout/Header'
import KpiCard from '../components/ui/KpiCard'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { MESES } from '../types'
import { useAuthStore } from '../store/auth'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return <PageLoading text="Cargando dashboard..." />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs principales */}
        <div>
          <p className="section-title mb-3">Resumen de agentes — mes corriente</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <KpiCard title="Total en nómina" value={data?.total_agentes ?? 0} icon={Users} color="blue" />
            <KpiCard title="Activos" value={data?.agentes_activos ?? 0} icon={UserCheck} color="green"
              subtitle="Estado ACTIVO en nómina" />
            <KpiCard title="Licencia" value={data?.agentes_lp ?? 0} icon={Clock} color="yellow"
              subtitle="Con licencia vigente hoy" />
            <KpiCard title="Dados de baja" value={data?.agentes_inactivos ?? 0} icon={UserX} color="red"
              subtitle="Desactivados del sistema" />
            <KpiCard title="No presentes" value={data?.agentes_no_presentes ?? 0} icon={AlertCircle} color="gray"
              subtitle="Última carga" />
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
              {data?.por_servicio?.map((s) => {
                const max = Math.max(...(data.por_servicio?.map((x) => x.total_agentes) ?? [1]))
                const pct = max > 0 ? (s.total_agentes / max) * 100 : 0
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
              })}
              {!data?.por_servicio?.length && (
                <p className="text-sm text-gray-400">Sin datos de servicios</p>
              )}
            </div>
          </div>
        </div>

        {user?.rol === 'ADMINISTRADOR' && data?.usuarios_activos !== null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Usuarios activos" value={data?.usuarios_activos ?? 0} icon={Users} color="purple" />
            <KpiCard title="Nóminas cerradas" value={data?.nominas_cerradas ?? 0} icon={FileSpreadsheet} color="gray" />
          </div>
        )}
      </div>
    </div>
  )
}
