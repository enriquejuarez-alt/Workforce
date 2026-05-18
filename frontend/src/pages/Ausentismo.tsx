import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { Download, TrendingDown, UserX, ClipboardList, Palmtree } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import KpiCard from '../components/ui/KpiCard'
import { reportesApi, serviciosApi } from '../lib/api'

const currentYear = new Date().getFullYear()
const defaultDesde = `${currentYear}-01-01`
const defaultHasta = new Date().toISOString().split('T')[0]

export default function Ausentismo() {
  const [fechaDesde, setFechaDesde] = useState(defaultDesde)
  const [fechaHasta, setFechaHasta] = useState(defaultHasta)
  const [servicioId, setServicioId] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ausentismo', fechaDesde, fechaHasta, servicioId],
    queryFn: () =>
      reportesApi.ausentismo({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        ...(servicioId ? { servicio_id: servicioId } : {}),
      }).then((r) => r.data),
  })

  const resumen = data?.resumen
  const porServicio: any[] = data?.por_servicio ?? []
  const porMes: any[] = data?.por_mes ?? []

  async function handleExport() {
    setExporting(true)
    try {
      const res = await reportesApi.exportAusentismo({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        ...(servicioId ? { servicio_id: servicioId } : {}),
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `ausentismo_${fechaDesde}_${fechaHasta}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ausentismo"
        subtitle="Reporte de licencias, vacaciones y bajas por período"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Filtros */}
        <div className="card p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="input-field text-sm h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="input-field text-sm h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Servicio</label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="input-field text-sm h-9 min-w-[180px]"
            >
              <option value="">Todos los servicios</option>
              {servicios.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || isLoading}
            className="btn-secondary flex items-center gap-2 h-9 ml-auto disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Licencias"
            value={isLoading ? '—' : (resumen?.licencias.cantidad ?? 0)}
            subtitle={resumen ? `${resumen.licencias.dias_total} días · ${resumen.licencias.agentes_unicos} agentes` : undefined}
            icon={ClipboardList}
            color="blue"
          />
          <KpiCard
            title="Vacaciones"
            value={isLoading ? '—' : (resumen?.vacaciones.cantidad ?? 0)}
            subtitle={resumen ? `${resumen.vacaciones.dias_total} días · ${resumen.vacaciones.agentes_unicos} agentes` : undefined}
            icon={Palmtree}
            color="green"
          />
          <KpiCard
            title="Bajas"
            value={isLoading ? '—' : (resumen?.bajas.cantidad ?? 0)}
            icon={UserX}
            color="red"
          />
          <KpiCard
            title="Días de ausencia"
            value={isLoading ? '—' : (resumen?.dias_total ?? 0)}
            subtitle={resumen ? `Sobre ${resumen.total_agentes} agentes activos` : undefined}
            icon={TrendingDown}
            color="yellow"
          />
        </div>

        {/* Gráficos */}
        {!isLoading && (porServicio.length > 0 || porMes.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barras por servicio */}
            {porServicio.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Por servicio</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, porServicio.length * 42)}>
                  <BarChart
                    data={porServicio}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: any, name: any) => [value, name?.charAt(0).toUpperCase() + name?.slice(1)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="licencias" name="Licencias" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="vacaciones" name="Vacaciones" stackId="a" fill="#22c55e" />
                    <Bar dataKey="bajas" name="Bajas" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Línea tendencia mensual */}
            {porMes.length > 1 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendencia mensual</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, porServicio.length * 42)}>
                  <LineChart data={porMes} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="licencias" name="Licencias" stroke="#3b82f6" strokeWidth={2} dot={porMes.length <= 12} />
                    <Line type="monotone" dataKey="vacaciones" name="Vacaciones" stroke="#22c55e" strokeWidth={2} dot={porMes.length <= 12} />
                    <Line type="monotone" dataKey="bajas" name="Bajas" stroke="#ef4444" strokeWidth={2} dot={porMes.length <= 12} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Tabla por servicio */}
        {!isLoading && porServicio.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Detalle por servicio</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-th">Servicio</th>
                    <th className="table-th text-right">Licencias</th>
                    <th className="table-th text-right">Días lic.</th>
                    <th className="table-th text-right">Vacaciones</th>
                    <th className="table-th text-right">Días vac.</th>
                    <th className="table-th text-right">Bajas</th>
                    <th className="table-th text-right">Total eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {porServicio.map((s: any) => (
                    <tr key={s.servicio_id} className="table-tr">
                      <td className="table-td">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                          <span className="font-medium text-gray-900">{s.nombre}</span>
                        </span>
                      </td>
                      <td className="table-td text-right font-medium text-blue-700">{s.licencias}</td>
                      <td className="table-td text-right text-gray-500">{s.dias_licencia}</td>
                      <td className="table-td text-right font-medium text-green-700">{s.vacaciones}</td>
                      <td className="table-td text-right text-gray-500">{s.dias_vacacion}</td>
                      <td className="table-td text-right font-medium text-red-600">{s.bajas}</td>
                      <td className="table-td text-right font-semibold text-gray-900">
                        {s.licencias + s.vacaciones + s.bajas}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="table-td font-semibold text-gray-700">Total</td>
                    <td className="table-td text-right font-semibold text-blue-700">
                      {porServicio.reduce((s: number, r: any) => s + r.licencias, 0)}
                    </td>
                    <td className="table-td text-right font-semibold text-gray-600">
                      {porServicio.reduce((s: number, r: any) => s + r.dias_licencia, 0)}
                    </td>
                    <td className="table-td text-right font-semibold text-green-700">
                      {porServicio.reduce((s: number, r: any) => s + r.vacaciones, 0)}
                    </td>
                    <td className="table-td text-right font-semibold text-gray-600">
                      {porServicio.reduce((s: number, r: any) => s + r.dias_vacacion, 0)}
                    </td>
                    <td className="table-td text-right font-semibold text-red-600">
                      {porServicio.reduce((s: number, r: any) => s + r.bajas, 0)}
                    </td>
                    <td className="table-td text-right font-bold text-gray-900">
                      {porServicio.reduce((s: number, r: any) => s + r.licencias + r.vacaciones + r.bajas, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Cargando reporte...
          </div>
        )}

        {!isLoading && porServicio.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <TrendingDown size={40} className="mb-2 opacity-30" />
            <p className="text-sm">Sin datos para el período seleccionado</p>
          </div>
        )}
      </div>
    </div>
  )
}
