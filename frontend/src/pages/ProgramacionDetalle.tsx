import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Play, Download, AlertTriangle, Users, CheckCircle, XCircle } from 'lucide-react'
import { programacionApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { MESES } from '../types'
import type { RequeridoHorario, SimulacionResponse } from '../types'

const SEMANA_LABELS: Record<number, string> = { 0: 'Mes completo', 1: 'Sem 1', 2: 'Sem 2', 3: 'Sem 3', 4: 'Sem 4' }
const TIPO_DIA_LABELS = { SEMANA: 'L–V', SABADO: 'Sáb', DOMINGO: 'Dom' } as const
type TipoDia = keyof typeof TIPO_DIA_LABELS

const HORAS_DEFAULT = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']

const ESTADO_CELL: Record<string, string> = {
  UNDER: 'bg-red-400',
  OK: 'bg-green-400',
  OVER: 'bg-blue-400',
}

export default function ProgramacionDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const progId = parseInt(id!)

  const [tab, setTab] = useState<'config' | 'sim'>('config')
  const [reqs, setReqs] = useState<Record<string, number>>({})  // key: "SEMANA:09:00"
  const [factor, setFactor] = useState({ deslogueo: 0, ausentismo: 0, rotacion: 0 })
  const [sim, setSim] = useState<SimulacionResponse | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null)

  const { data: prog, isLoading } = useQuery({
    queryKey: ['programacion', progId],
    queryFn: () => programacionApi.get(progId).then(r => r.data),
  })

  useEffect(() => {
    if (!prog) return
    const map: Record<string, number> = {}
    for (const r of prog.requeridos ?? []) {
      map[`${r.tipo_dia}:${r.intervalo}`] = r.requeridos
    }
    setReqs(map)
    if (prog.factor) {
      setFactor({
        deslogueo: prog.factor.deslogueo,
        ausentismo: prog.factor.ausentismo,
        rotacion: prog.factor.rotacion,
      })
    }
  }, [prog])

  const saveReqsMut = useMutation({
    mutationFn: () => {
      const arr: Omit<RequeridoHorario, 'id' | 'programacion_id'>[] = []
      for (const [key, val] of Object.entries(reqs)) {
        if (val > 0) {
          // key format: "SEMANA:09:00" — tipo_dia is everything before first colon, rest is time
          const colonIdx = key.indexOf(':')
          const tipo_dia = key.substring(0, colonIdx) as TipoDia
          const intervalo = key.substring(colonIdx + 1)
          arr.push({ tipo_dia, intervalo, requeridos: val })
        }
      }
      return programacionApi.upsertRequeridos(progId, arr)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programacion', progId] }),
  })

  const saveFactorMut = useMutation({
    mutationFn: () => programacionApi.upsertFactor(progId, factor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programacion', progId] }),
  })

  const simMut = useMutation({
    mutationFn: () => programacionApi.simular(progId).then(r => r.data),
    onSuccess: (data) => {
      setSim(data)
      setTab('sim')
    },
  })

  function handleExport() {
    programacionApi.export(progId).then(res => {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `programacion_${prog?.servicio.nombre}_${prog?.mes}_${prog?.anio}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function setReq(tipoDia: TipoDia, hora: string, val: string) {
    const n = parseInt(val) || 0
    setReqs(prev => ({ ...prev, [`${tipoDia}:${hora}`]: n }))
  }

  // Build simulation grid: indexed by intervalo → fecha → resultado
  const simGrid = useMemo(() => {
    if (!sim) return null
    const map = new Map<string, Map<string, typeof sim.resultados[0]>>()
    for (const r of sim.resultados) {
      if (!map.has(r.intervalo)) map.set(r.intervalo, new Map())
      map.get(r.intervalo)!.set(r.fecha, r)
    }
    return map
  }, [sim])

  const simStats = useMemo(() => {
    if (!sim) return null
    const under = sim.resultados.filter(r => r.estado === 'UNDER').length
    const ok = sim.resultados.filter(r => r.estado === 'OK').length
    const over = sim.resultados.filter(r => r.estado === 'OVER').length
    return { under, ok, over, total: sim.resultados.length }
  }, [sim])

  if (isLoading) return <PageLoading />
  if (!prog) return <div className="p-6 text-gray-500">Programación no encontrada</div>

  const periodoLabel = `${MESES[prog.mes - 1]} ${prog.anio}${prog.semana > 0 ? ` · ${SEMANA_LABELS[prog.semana]}` : ''}`

  return (
    <div className="flex flex-col h-full">
      <Header
        title={prog.servicio.nombre}
        subtitle={periodoLabel}
        actions={
          <div className="flex items-center gap-2">
            {sim && (
              <button className="btn-secondary" onClick={handleExport}>
                <Download size={14} /> Exportar
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => simMut.mutate()}
              disabled={simMut.isPending}
            >
              <Play size={14} />
              {simMut.isPending ? 'Simulando…' : 'Simular'}
            </button>
            <button className="btn-secondary" onClick={() => navigate('/programacion')}>
              <ArrowLeft size={14} /> Volver
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {(['config', 'sim'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t
                  ? 'border-konecta text-konecta'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'config' ? 'Configuración' : 'Simulación'}
            </button>
          ))}
        </div>

        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Requeridos por hora */}
            <div className="lg:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">Requeridos por franja horaria</p>
                <button
                  className="btn-primary text-xs py-1.5 px-3"
                  onClick={() => saveReqsMut.mutate()}
                  disabled={saveReqsMut.isPending}
                >
                  <Save size={12} /> {saveReqsMut.isPending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium w-20">Hora</th>
                      {(Object.entries(TIPO_DIA_LABELS) as [TipoDia, string][]).map(([k, v]) => (
                        <th key={k} className="text-center py-2 px-3 text-gray-600 font-semibold">{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORAS_DEFAULT.map(hora => (
                      <tr key={hora} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-4 font-mono font-semibold text-gray-700">{hora}</td>
                        {(Object.keys(TIPO_DIA_LABELS) as TipoDia[]).map(tipoDia => (
                          <td key={tipoDia} className="py-1.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={999}
                              className="w-16 text-center border border-gray-200 rounded-lg py-1 px-2 text-xs focus:ring-1 focus:ring-konecta focus:border-konecta"
                              value={reqs[`${tipoDia}:${hora}`] ?? ''}
                              placeholder="0"
                              onChange={e => setReq(tipoDia, hora, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {saveReqsMut.isSuccess && (
                <p className="text-xs text-green-600 mt-2">Guardado correctamente</p>
              )}
            </div>

            {/* Factor de reducción */}
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-800">Factor de reducción</p>
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    onClick={() => saveFactorMut.mutate()}
                    disabled={saveFactorMut.isPending}
                  >
                    <Save size={12} /> {saveFactorMut.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                <div className="space-y-3">
                  {(['deslogueo', 'ausentismo', 'rotacion'] as const).map(field => (
                    <div key={field}>
                      <label className="label-base capitalize">{field}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          className="input-base w-full"
                          value={factor[field]}
                          onChange={e => setFactor(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="text-xs text-gray-400 shrink-0">
                          {(factor[field] * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Total reducción</span>
                      <span className="font-bold text-gray-800">
                        {((factor.deslogueo + factor.ausentismo + factor.rotacion) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                {saveFactorMut.isSuccess && (
                  <p className="text-xs text-green-600 mt-2">Guardado correctamente</p>
                )}
              </div>

              <div className="card p-4 bg-blue-50 border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Cómo funciona</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  El sistema cuenta los agentes cuyo horario cubre cada franja y aplica el factor de reducción para estimar la cobertura efectiva.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Los horarios se parsean del campo <span className="font-mono">horarios</span> del agente (ej: "09:00").
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'sim' && (
          <div className="space-y-5">
            {simMut.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">
                <AlertTriangle size={14} />
                {(simMut.error as any)?.response?.data?.error ?? 'Error al simular'}
              </div>
            )}

            {!sim && !simMut.isPending && (
              <div className="card p-12 text-center">
                <Play size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">Sin simulación</p>
                <p className="text-xs text-gray-400 mt-1">Configurá los requeridos y hacé click en "Simular"</p>
              </div>
            )}

            {simMut.isPending && (
              <div className="card p-12 text-center">
                <div className="w-8 h-8 border-2 border-konecta border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Calculando cobertura…</p>
              </div>
            )}

            {sim && simStats && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="card p-4 text-center">
                    <Users size={16} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-2xl font-bold text-gray-900">{sim.total_agentes}</p>
                    <p className="text-xs text-gray-500">Agentes activos</p>
                    {sim.agentes_sin_ingreso > 0 && (
                      <p className="text-[10px] text-orange-500 mt-0.5">{sim.agentes_sin_ingreso} sin horario</p>
                    )}
                  </div>
                  <div className="card p-4 text-center border-green-200">
                    <CheckCircle size={16} className="mx-auto text-green-500 mb-1" />
                    <p className="text-2xl font-bold text-green-700">{simStats.ok}</p>
                    <p className="text-xs text-gray-500">Franjas OK</p>
                  </div>
                  <div className="card p-4 text-center border-red-200">
                    <XCircle size={16} className="mx-auto text-red-500 mb-1" />
                    <p className="text-2xl font-bold text-red-700">{simStats.under}</p>
                    <p className="text-xs text-gray-500">UNDER</p>
                  </div>
                  <div className="card p-4 text-center border-blue-200">
                    <AlertTriangle size={16} className="mx-auto text-blue-500 mb-1" />
                    <p className="text-2xl font-bold text-blue-700">{simStats.over}</p>
                    <p className="text-xs text-gray-500">OVER</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 shrink-0" />UNDER — cobertura insuficiente</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 shrink-0" />OK — cobertura adecuada</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 shrink-0" />OVER — cobertura excedida</span>
                </div>

                {/* Grid */}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left text-gray-500 font-medium border-b border-r border-gray-100 w-16">Hora</th>
                          {sim.fechas.map(f => (
                            <th
                              key={f.fecha}
                              className="px-1 py-2 text-center text-gray-500 font-medium border-b border-gray-100 min-w-[36px]"
                            >
                              <div className="text-[10px] text-gray-400">{f.dia_semana}</div>
                              <div className="font-bold text-gray-700">{f.dia_num}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sim.intervalos.map(intervalo => (
                          <tr key={intervalo} className="border-b border-gray-50">
                            <td className="sticky left-0 bg-white z-10 px-3 py-1 font-mono font-semibold text-gray-600 border-r border-gray-100">
                              {intervalo}
                            </td>
                            {sim.fechas.map(f => {
                              const cell = simGrid?.get(intervalo)?.get(f.fecha)
                              if (!cell) return (
                                <td key={f.fecha} className="px-1 py-1 text-center">
                                  <div className="w-8 h-6 rounded mx-auto bg-gray-50" />
                                </td>
                              )
                              return (
                                <td
                                  key={f.fecha}
                                  className="px-1 py-1 text-center cursor-pointer"
                                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, data: cell })}
                                  onMouseLeave={() => setTooltip(null)}
                                >
                                  <div
                                    className={`w-8 h-6 rounded mx-auto flex items-center justify-center text-[10px] font-bold text-white ${ESTADO_CELL[cell.estado]}`}
                                    title={`${cell.asignados}/${cell.requeridos}`}
                                  >
                                    {cell.asignados}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary table */}
                <div className="card p-5">
                  <p className="text-sm font-bold text-gray-800 mb-3">Resumen por franja</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="table-th">Hora</th>
                          <th className="table-th text-center">Prom. asignados</th>
                          <th className="table-th text-center">Prom. requeridos</th>
                          <th className="table-th text-center">UNDER</th>
                          <th className="table-th text-center">OK</th>
                          <th className="table-th text-center">OVER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sim.intervalos.map(intervalo => {
                          const cells = sim.resultados.filter(r => r.intervalo === intervalo)
                          const avgAsig = cells.length
                            ? (cells.reduce((s, c) => s + c.asignados, 0) / cells.length).toFixed(1)
                            : '—'
                          const avgReq = cells.length
                            ? (cells.reduce((s, c) => s + c.requeridos, 0) / cells.length).toFixed(1)
                            : '—'
                          const under = cells.filter(c => c.estado === 'UNDER').length
                          const ok = cells.filter(c => c.estado === 'OK').length
                          const over = cells.filter(c => c.estado === 'OVER').length
                          return (
                            <tr key={intervalo} className="table-tr">
                              <td className="table-td font-mono font-semibold">{intervalo}</td>
                              <td className="table-td text-center">{avgAsig}</td>
                              <td className="table-td text-center">{avgReq}</td>
                              <td className="table-td text-center">
                                {under > 0 && <span className="text-red-600 font-semibold">{under}</span>}
                                {under === 0 && <span className="text-gray-300">—</span>}
                              </td>
                              <td className="table-td text-center">
                                {ok > 0 && <span className="text-green-600 font-semibold">{ok}</span>}
                                {ok === 0 && <span className="text-gray-300">—</span>}
                              </td>
                              <td className="table-td text-center">
                                {over > 0 && <span className="text-blue-600 font-semibold">{over}</span>}
                                {over === 0 && <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-bold mb-1">{tooltip.data.fecha} · {tooltip.data.intervalo}</p>
          <div className="flex gap-3 mb-2">
            <span>Asignados: <strong>{tooltip.data.asignados}</strong></span>
            <span>Req: <strong>{tooltip.data.requeridos}</strong></span>
            <span className={`font-bold ${tooltip.data.estado === 'UNDER' ? 'text-red-300' : tooltip.data.estado === 'OVER' ? 'text-blue-300' : 'text-green-300'}`}>
              {tooltip.data.estado}
            </span>
          </div>
          {tooltip.data.agentes?.length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <p className="text-gray-400 mb-1">Presentes:</p>
              {tooltip.data.agentes.slice(0, 8).map((a: string, i: number) => (
                <p key={i} className="truncate">{a}</p>
              ))}
              {tooltip.data.agentes.length > 8 && (
                <p className="text-gray-400">+{tooltip.data.agentes.length - 8} más</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
