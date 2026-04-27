import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, Users, UserPlus, UserMinus, ArrowLeftRight } from 'lucide-react'
import Header from '../components/layout/Header'
import { nominasApi, serviciosApi } from '../lib/api'
import { MESES } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import KpiCard from '../components/ui/KpiCard'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function Comparacion() {
  const [servicioId, setServicioId] = useState('')
  const [mes1, setMes1] = useState(currentMonth > 1 ? currentMonth - 1 : 12)
  const [anio1, setAnio1] = useState(currentMonth > 1 ? currentYear : currentYear - 1)
  const [mes2, setMes2] = useState(currentMonth)
  const [anio2, setAnio2] = useState(currentYear)
  const [buscar, setBuscar] = useState(false)

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: comparacion, isLoading, error } = useQuery({
    queryKey: ['comparacion', servicioId, mes1, anio1, mes2, anio2],
    queryFn: () =>
      nominasApi.comparar({
        servicioId: parseInt(servicioId),
        mes1, anio1, mes2, anio2,
      }).then((r) => r.data),
    enabled: buscar && !!servicioId,
  })

  return (
    <div className="flex flex-col h-full">
      <Header title="Comparación de Nóminas" subtitle="Comparar cambios entre dos períodos" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Configuración */}
        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="label-base">Servicio</label>
              <select className="input-base w-64" value={servicioId} onChange={(e) => { setServicioId(e.target.value); setBuscar(false) }}>
                <option value="">Seleccionar servicio...</option>
                {servicios.filter((s: any) => s.activo).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wide">Período 1</p>
              <div className="space-y-2">
                <select className="input-base" value={mes1} onChange={(e) => setMes1(parseInt(e.target.value))}>
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select className="input-base" value={anio1} onChange={(e) => setAnio1(parseInt(e.target.value))}>
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-konecta/10 flex items-center justify-center">
                <ArrowLeftRight size={18} className="text-konecta" />
              </div>
            </div>

            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wide">Período 2</p>
              <div className="space-y-2">
                <select className="input-base" value={mes2} onChange={(e) => setMes2(parseInt(e.target.value))}>
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select className="input-base" value={anio2} onChange={(e) => setAnio2(parseInt(e.target.value))}>
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            className="btn-primary mt-4"
            onClick={() => setBuscar(true)}
            disabled={!servicioId || isLoading}
          >
            <GitCompare size={14} />
            {isLoading ? 'Comparando...' : 'Comparar períodos'}
          </button>
        </div>

        {isLoading && <PageLoading text="Comparando nóminas..." />}

        {error && (
          <div className="card p-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">Error: Una o ambas nóminas no existen para este período.</p>
          </div>
        )}

        {comparacion && !isLoading && (
          <>
            {/* Header comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4 bg-blue-50 border-blue-200 text-center">
                <p className="text-lg font-bold text-blue-800">{MESES[comparacion.nomina1.mes - 1]} {comparacion.nomina1.anio}</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{comparacion.nomina1.total}</p>
                <p className="text-xs text-blue-500">agentes</p>
              </div>
              <div className="card p-4 bg-blue-50 border-blue-200 text-center">
                <p className="text-lg font-bold text-blue-800">{MESES[comparacion.nomina2.mes - 1]} {comparacion.nomina2.anio}</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{comparacion.nomina2.total}</p>
                <p className="text-xs text-blue-500">agentes</p>
              </div>
            </div>

            {/* KPIs */}
            <div>
              <p className="section-title mb-3">Resumen de cambios</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard title="Nuevos" value={comparacion.resumen.nuevos} icon={UserPlus} color="green" />
                <KpiCard title="No presentes" value={comparacion.resumen.no_presentes} icon={UserMinus} color="red" />
                <KpiCard title="Con cambios" value={comparacion.resumen.con_cambios} icon={GitCompare} color="purple" />
                <KpiCard title="Cambios estado" value={comparacion.resumen.cambios_estado} icon={Users} color="yellow" />
                <KpiCard title="Cambios horario" value={comparacion.resumen.cambios_horario} icon={Users} color="blue" />
                <KpiCard title="Cambios contrato" value={comparacion.resumen.cambios_contrato} icon={Users} color="orange" />
              </div>
            </div>

            {/* Agentes nuevos */}
            {comparacion.agentes_nuevos.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                  <UserPlus size={14} /> {comparacion.agentes_nuevos.length} agentes nuevos en {MESES[comparacion.nomina2.mes - 1]}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {comparacion.agentes_nuevos.map((a: any) => (
                    <span key={a.id} className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium">{a.nombre}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Agentes que ya no figuran */}
            {comparacion.agentes_no_presentes.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                  <UserMinus size={14} /> {comparacion.agentes_no_presentes.length} agentes que ya no figuran
                </h3>
                <div className="flex flex-wrap gap-2">
                  {comparacion.agentes_no_presentes.map((a: any) => (
                    <span key={a.id} className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">{a.nombre}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Cambios detallados */}
            {comparacion.cambios.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <GitCompare size={14} /> {comparacion.cambios.length} agentes con cambios
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-gray-100">
                      <th className="table-th">Agente</th>
                      <th className="table-th">Campo</th>
                      <th className="table-th">Antes ({MESES[comparacion.nomina1.mes - 1]})</th>
                      <th className="table-th">Después ({MESES[comparacion.nomina2.mes - 1]})</th>
                    </tr></thead>
                    <tbody>
                      {comparacion.cambios.flatMap((c: any) =>
                        Object.entries(c.cambios).map(([campo, vals]: [string, any]) => (
                          <tr key={`${c.agente_id}-${campo}`} className="table-tr">
                            <td className="table-td font-medium">{c.nombre}</td>
                            <td className="table-td font-mono uppercase text-gray-500">{campo}</td>
                            <td className="table-td text-red-600">{String(vals.antes) || '—'}</td>
                            <td className="table-td text-green-600">{String(vals.despues) || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {buscar && !isLoading && !comparacion && !error && (
          <EmptyState icon={GitCompare} title="Sin datos" description="Seleccioná un servicio y dos períodos para comparar." />
        )}
      </div>
    </div>
  )
}
