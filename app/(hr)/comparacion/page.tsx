"use client";

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, Users, UserPlus, UserMinus, ArrowLeftRight } from 'lucide-react'
import Header from '@/components/hr/layout/Header'
import { nominasApi, serviciosApi } from '@/lib/api'
import { MESES } from '@/types'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import EmptyState from '@/components/hr/ui/EmptyState'
import KpiCard from '@/components/hr/ui/KpiCard'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const CAMPO_LABELS: Record<string, { label: string; color: string }> = {
  estado:      { label: 'Estado laboral',  color: 'bg-yellow-100 text-yellow-800' },
  horarios:    { label: 'Horario',          color: 'bg-blue-100 text-blue-800' },
  contrato:    { label: 'Contrato (hs)',    color: 'bg-orange-100 text-orange-800' },
  superior:    { label: 'Superior',         color: 'bg-purple-100 text-purple-800' },
  modalidad:   { label: 'Modalidad',        color: 'bg-teal-100 text-teal-800' },
  servicio_id: { label: 'Servicio',         color: 'bg-pink-100 text-pink-800' },
  segmento:    { label: 'Segmento',         color: 'bg-indigo-100 text-indigo-800' },
  sitio:       { label: 'Sitio',            color: 'bg-gray-100 text-gray-700' },
  jefe:        { label: 'Jefe',             color: 'bg-gray-100 text-gray-700' },
}

export default function Comparacion() {
  const [servicioId, setServicioId] = useState('')
  const [mes1, setMes1] = useState(currentMonth > 1 ? currentMonth - 1 : 12)
  const [anio1, setAnio1] = useState(currentMonth > 1 ? currentYear : currentYear - 1)
  const [mes2, setMes2] = useState(currentMonth)
  const [anio2, setAnio2] = useState(currentYear)
  const [cruzarTipos, setCruzarTipos] = useState(false)
  const [buscar, setBuscar] = useState(false)

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: comparacion, isLoading, error } = useQuery({
    queryKey: ['comparacion', servicioId, mes1, anio1, mes2, anio2, cruzarTipos],
    queryFn: () =>
      nominasApi.comparar({
        servicioId: parseInt(servicioId),
        mes1, anio1, mes2, anio2,
        ...(cruzarTipos ? { tipo1: 'OPERACION', tipo2: 'MEUCCI' } : {}),
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
            <div className="md:col-span-3 flex flex-wrap items-end gap-6">
              <div>
                <label className="label-base">Servicio</label>
                <select className="input-base w-64" value={servicioId} onChange={(e) => { setServicioId(e.target.value); setBuscar(false) }}>
                  <option value="">Seleccionar servicio...</option>
                  {servicios.filter((s: any) => s.activo).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cruzarTipos ? 'bg-konecta' : 'bg-gray-300'}`}
                  onClick={() => { setCruzarTipos((v) => !v); setBuscar(false) }}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cruzarTipos ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Cruzar Operación ↔ Meucci</span>
              </label>
            </div>

            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wide">
                {cruzarTipos ? 'Operación — Período' : 'Período 1'}
              </p>
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
              <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wide">
                {cruzarTipos ? 'Meucci — Período' : 'Período 2'}
              </p>
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
              {[comparacion.nomina1, comparacion.nomina2].map((nom, i) => (
                <div key={i} className="card p-5 bg-blue-50 border-blue-200">
                  <p className="text-center text-lg font-bold text-blue-800">{MESES[nom.mes - 1]} {nom.anio}</p>
                  {nom.tipo && (
                    <p className="text-center text-xs font-semibold text-blue-600 uppercase tracking-wide mt-0.5">
                      {nom.tipo === 'MEUCCI' ? 'Meucci' : 'Operación'}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 divide-x divide-blue-200 text-center">
                    <div className="px-3">
                      <p className="text-2xl font-black text-blue-600">{nom.total}</p>
                      <p className="text-xs text-blue-500 mt-0.5">Total</p>
                    </div>
                    <div className="px-3">
                      <p className="text-2xl font-black text-green-600">{nom.activos}</p>
                      <p className="text-xs text-green-500 mt-0.5">Activos</p>
                    </div>
                    <div className="px-3">
                      <p className="text-2xl font-black text-yellow-600">{nom.licencia}</p>
                      <p className="text-xs text-yellow-500 mt-0.5">Licencia</p>
                    </div>
                  </div>
                  {i === 0 && comparacion.nomina2 && (
                    <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-3 text-center text-xs text-gray-500">
                      <div>
                        <span className={`font-bold ${comparacion.nomina2.total - nom.total > 0 ? 'text-green-600' : comparacion.nomina2.total - nom.total < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {comparacion.nomina2.total - nom.total > 0 ? '+' : ''}{comparacion.nomina2.total - nom.total}
                        </span> dif. total
                      </div>
                      <div>
                        <span className={`font-bold ${comparacion.nomina2.activos - nom.activos > 0 ? 'text-green-600' : comparacion.nomina2.activos - nom.activos < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {comparacion.nomina2.activos - nom.activos > 0 ? '+' : ''}{comparacion.nomina2.activos - nom.activos}
                        </span> dif. activos
                      </div>
                      <div>
                        <span className={`font-bold ${comparacion.nomina2.licencia - nom.licencia > 0 ? 'text-yellow-600' : comparacion.nomina2.licencia - nom.licencia < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                          {comparacion.nomina2.licencia - nom.licencia > 0 ? '+' : ''}{comparacion.nomina2.licencia - nom.licencia}
                        </span> dif. licencia
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* KPIs */}
            {!cruzarTipos && (
              <div>
                <p className="section-title mb-3">Resumen de cambios</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard title="Nuevos" value={comparacion.resumen.nuevos} icon={UserPlus} color="green" />
                  <KpiCard title="No presentes" value={comparacion.resumen.no_presentes} icon={UserMinus} color="red" />
                  <KpiCard title="Con cambios" value={comparacion.resumen.con_cambios} icon={GitCompare} color="purple" />
                  <KpiCard title="Cambio de estado" value={comparacion.resumen.cambios_estado} icon={Users} color="yellow"
                    subtitle="Estado laboral (ACTIVO, LP…)" />
                  <KpiCard title="Cambio de horario" value={comparacion.resumen.cambios_horario} icon={Users} color="blue"
                    subtitle="Horario de entrada/salida" />
                  <KpiCard title="Cambio de contrato" value={comparacion.resumen.cambios_contrato} icon={Users} color="orange"
                    subtitle="Horas semanales" />
                </div>
              </div>
            )}

            {/* Agentes solo en una nómina — vista cruzada Operación ↔ Meucci */}
            {cruzarTipos && (comparacion.agentes_nuevos.length > 0 || comparacion.agentes_no_presentes.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Izquierda: Solo en Operación (alineado con la card OPERACIÓN) */}
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-orange-700 mb-1 flex items-center gap-2">
                    <UserMinus size={14} />
                    Figuran en Operación pero no en Meucci
                    <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{comparacion.agentes_no_presentes.length}</span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Agentes que están cargados en la nómina de Operación y no aparecen en Meucci</p>
                  {comparacion.agentes_no_presentes.length === 0
                    ? <p className="text-xs text-gray-400">Ninguno</p>
                    : <div className="flex flex-wrap gap-2">
                        {comparacion.agentes_no_presentes.map((a: any) => (
                          <span key={a.id} className="px-2 py-1 bg-orange-50 text-orange-800 rounded-lg text-xs font-medium border border-orange-200">{a.nombre}</span>
                        ))}
                      </div>
                  }
                </div>
                {/* Derecha: Solo en Meucci (alineado con la card MEUCCI) */}
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-blue-700 mb-1 flex items-center gap-2">
                    <UserPlus size={14} />
                    Figuran en Meucci pero no en Operación
                    <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{comparacion.agentes_nuevos.length}</span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Agentes que están cargados en Meucci y no aparecen en la nómina de Operación</p>
                  {comparacion.agentes_nuevos.length === 0
                    ? <p className="text-xs text-gray-400">Ninguno</p>
                    : <div className="flex flex-wrap gap-2">
                        {comparacion.agentes_nuevos.map((a: any) => (
                          <span key={a.id} className="px-2 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-200">{a.nombre}</span>
                        ))}
                      </div>
                  }
                </div>
              </div>
            )}

            {/* Agentes nuevos — vista mismo tipo */}
            {!cruzarTipos && comparacion.agentes_nuevos.length > 0 && (
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

            {/* Agentes que ya no figuran — vista mismo tipo */}
            {!cruzarTipos && comparacion.agentes_no_presentes.length > 0 && (
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

            {/* Cambios detallados — solo en comparativa mismo tipo */}
            {!cruzarTipos && comparacion.cambios.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <GitCompare size={14} /> {comparacion.cambios.length} agentes con cambios
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-th">Agente</th>
                        <th className="table-th">Qué cambió</th>
                        <th className="table-th">
                          {MESES[comparacion.nomina1.mes - 1]} {comparacion.nomina1.anio}
                          {comparacion.nomina1.tipo && <span className="ml-1 text-gray-400">({comparacion.nomina1.tipo === 'MEUCCI' ? 'Meucci' : 'Op.'})</span>}
                        </th>
                        <th className="table-th">
                          {MESES[comparacion.nomina2.mes - 1]} {comparacion.nomina2.anio}
                          {comparacion.nomina2.tipo && <span className="ml-1 text-gray-400">({comparacion.nomina2.tipo === 'MEUCCI' ? 'Meucci' : 'Op.'})</span>}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparacion.cambios.flatMap((c: any) =>
                        Object.entries(c.cambios).map(([campo, vals]: [string, any], idx) => (
                          <tr key={`${c.agente_id}-${campo}`} className="table-tr">
                            <td className="table-td font-medium text-gray-800">
                              {idx === 0 ? c.nombre : <span className="text-gray-300">↑</span>}
                            </td>
                            <td className="table-td">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAMPO_LABELS[campo]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                {CAMPO_LABELS[campo]?.label ?? campo}
                              </span>
                            </td>
                            <td className="table-td">
                              <span className="text-red-600 font-medium">{vals.antes ?? '—'}</span>
                            </td>
                            <td className="table-td">
                              <span className="text-green-600 font-medium">{vals.despues ?? '—'}</span>
                            </td>
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
