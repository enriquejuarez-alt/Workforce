import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Play, Download, Upload, AlertTriangle, Users, CheckCircle,
  XCircle, ArrowRight, Sun, CalendarDays, ChevronRight } from 'lucide-react'
import { programacionApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { MESES } from '../types'
import type { SimulacionResponse, SimulacionResultado } from '../types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEMANA_LABELS: Record<number, string> = { 0: 'Mes completo', 1: 'Sem 1', 2: 'Sem 2', 3: 'Sem 3', 4: 'Sem 4' }
const HORAS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
type TipoDia = 'SEMANA' | 'SABADO' | 'DOMINGO'
const TIPO_DIA_COLS: TipoDia[] = ['SEMANA', 'SABADO', 'DOMINGO']
const TIPO_DIA_LABELS: Record<TipoDia, string> = { SEMANA: 'L–V', SABADO: 'Sáb', DOMINGO: 'Dom' }

const ESTADO_BG: Record<string, string> = {
  UNDER: 'bg-red-400',
  LIMITE: 'bg-orange-400',
  OK: 'bg-green-400',
  OVER: 'bg-blue-400',
}

// ─── Coverage curve (simple SVG) ───────────────────────────────────────────────

function CoverageCurve({ sim }: { sim: SimulacionResultado[] }) {
  // Aggregate by interval: average asignados vs average requeridos
  const byIntervalo = new Map<string, { asig: number[]; req: number[] }>()
  for (const r of sim) {
    if (!byIntervalo.has(r.intervalo)) byIntervalo.set(r.intervalo, { asig: [], req: [] })
    byIntervalo.get(r.intervalo)!.asig.push(r.asignados)
    byIntervalo.get(r.intervalo)!.req.push(r.requeridos)
  }
  const points = [...byIntervalo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([intv, d]) => ({
    intv,
    asig: d.asig.reduce((s, v) => s + v, 0) / d.asig.length,
    req: d.req.reduce((s, v) => s + v, 0) / d.req.length,
  }))

  if (points.length < 2) return null

  const W = 600, H = 160, PAD = 40
  const maxVal = Math.max(...points.flatMap(p => [p.asig, p.req]), 1)
  const scaleX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const scaleY = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2)

  const polyline = (vals: number[]) =>
    vals.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 160 }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PAD} y1={scaleY(maxVal * pct)} x2={W - PAD} y2={scaleY(maxVal * pct)}
          stroke="#f0f0f0" strokeWidth={1} />
      ))}
      {/* Requeridos line (dashed red) */}
      <polyline
        points={polyline(points.map(p => p.req))}
        fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" opacity={0.8}
      />
      {/* Asignados line (solid green) */}
      <polyline
        points={polyline(points.map(p => p.asig))}
        fill="none" stroke="#22c55e" strokeWidth={2.5}
      />
      {/* X axis labels */}
      {points.filter((_, i) => i % 2 === 0).map((p, i) => (
        <text key={i} x={scaleX(i * 2)} y={H - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {p.intv}
        </text>
      ))}
    </svg>
  )
}

// ─── Coverage grid component ────────────────────────────────────────────────────

function CoverageGrid({ sim, intervalos, fechas }: {
  sim: SimulacionResultado[]
  intervalos: string[]
  fechas: { fecha: string; dia_num: number; dia_semana: string }[]
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: SimulacionResultado } | null>(null)

  const cellMap = useMemo(() => {
    const map = new Map<string, Map<string, SimulacionResultado>>()
    for (const r of sim) {
      if (!map.has(r.intervalo)) map.set(r.intervalo, new Map())
      map.get(r.intervalo)!.set(r.fecha, r)
    }
    return map
  }, [sim])

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-medium text-gray-500 border-b border-r border-gray-100 min-w-[56px]">Hora</th>
              {fechas.map(f => (
                <th key={f.fecha} className="px-0.5 py-2 text-center text-gray-400 border-b border-gray-100 min-w-[32px]">
                  <div className="text-[9px]">{f.dia_semana}</div>
                  <div className="font-bold text-gray-600 text-[11px]">{f.dia_num}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {intervalos.map(intv => (
              <tr key={intv} className="border-b border-gray-50">
                <td className="sticky left-0 bg-white z-10 px-3 py-0.5 font-mono font-semibold text-gray-600 border-r border-gray-100 text-[11px]">{intv}</td>
                {fechas.map(f => {
                  const cell = cellMap.get(intv)?.get(f.fecha)
                  if (!cell) return <td key={f.fecha} className="px-0.5 py-0.5"><div className="w-7 h-5 rounded mx-auto bg-gray-50" /></td>
                  return (
                    <td key={f.fecha} className="px-0.5 py-0.5 cursor-pointer"
                      onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, data: cell })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className={`w-7 h-5 rounded mx-auto flex items-center justify-center text-[9px] font-bold text-white ${ESTADO_BG[cell.estado] ?? 'bg-gray-300'}`}>
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

      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-bold mb-1">{tooltip.data.fecha} · {tooltip.data.intervalo}</p>
          <div className="flex gap-3 mb-2 text-[11px]">
            <span>Asig: <strong>{tooltip.data.asignados}</strong></span>
            <span>Req: <strong>{tooltip.data.requeridos}</strong></span>
            <span className={`font-bold ${tooltip.data.estado === 'UNDER' ? 'text-red-300' : tooltip.data.estado === 'OVER' ? 'text-blue-300' : 'text-green-300'}`}>
              {tooltip.data.estado}
            </span>
          </div>
          {tooltip.data.agentes?.length > 0 && (
            <div className="border-t border-gray-700 pt-2 max-h-40 overflow-y-auto">
              <p className="text-gray-400 mb-1 text-[10px]">{tooltip.data.agentes.length} presentes:</p>
              {tooltip.data.agentes.slice(0, 10).map((a, i) => <p key={i} className="truncate text-[10px]">{a}</p>)}
              {tooltip.data.agentes.length > 10 && <p className="text-gray-400 text-[10px]">+{tooltip.data.agentes.length - 10} más</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Summary by interval ────────────────────────────────────────────────────────

function IntervalSummary({ sim, intervalos }: { sim: SimulacionResultado[]; intervalos: string[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="table-th">Hora</th>
          <th className="table-th text-right">Prom. Asig</th>
          <th className="table-th text-right">Prom. Req</th>
          <th className="table-th text-center text-red-600">UNDER</th>
          <th className="table-th text-center text-orange-500">LÍMITE</th>
          <th className="table-th text-center text-green-600">OK</th>
          <th className="table-th text-center text-blue-600">OVER</th>
        </tr>
      </thead>
      <tbody>
        {intervalos.map(intv => {
          const cells = sim.filter(r => r.intervalo === intv)
          const avg = (arr: number[]) => arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '—'
          return (
            <tr key={intv} className="table-tr">
              <td className="table-td font-mono font-semibold text-gray-700">{intv}</td>
              <td className="table-td text-right">{avg(cells.map(c => c.asignados))}</td>
              <td className="table-td text-right">{avg(cells.map(c => c.requeridos))}</td>
              {(['UNDER', 'LIMITE', 'OK', 'OVER'] as const).map(estado => {
                const count = cells.filter(c => c.estado === estado).length
                const colors: Record<string, string> = { UNDER: 'text-red-600 font-semibold', LIMITE: 'text-orange-500 font-semibold', OK: 'text-green-600 font-semibold', OVER: 'text-blue-600 font-semibold' }
                return <td key={estado} className={`table-td text-center ${count > 0 ? colors[estado] : 'text-gray-200'}`}>{count > 0 ? count : '—'}</td>
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProgramacionDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const progId = parseInt(id!)
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'config' | 'nomina' | 'simulacion' | 'movimientos' | 'feriados'>('config')
  // Manual reqs state: key = "SEMANA:09:00"
  const [reqs, setReqs] = useState<Record<string, number>>({})
  const [factor, setFactor] = useState({ deslogueo: 0, ausentismo: 0, rotacion: 0 })
  const [sim, setSim] = useState<SimulacionResponse | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')

  const { data: prog, isLoading } = useQuery({
    queryKey: ['programacion', progId],
    queryFn: () => programacionApi.get(progId).then(r => r.data),
  })

  useEffect(() => {
    if (!prog) return
    if (prog.factor) setFactor({ deslogueo: prog.factor.deslogueo, ausentismo: prog.factor.ausentismo, rotacion: prog.factor.rotacion })
    // Convert per-date reqs back to tipo_dia template (use first date of each type as representative)
    const map: Record<string, number> = {}
    for (const r of prog.requeridos ?? []) {
      const d = new Date(r.fecha)
      const dow = new Date(r.fecha + 'T12:00:00').getDay()
      const tipoDia: TipoDia = dow === 0 ? 'DOMINGO' : dow === 6 ? 'SABADO' : 'SEMANA'
      const key = `${tipoDia}:${r.intervalo}`
      if (!map[key]) map[key] = r.requeridos  // first occurrence wins
    }
    setReqs(map)
  }, [prog])

  const saveReqsMut = useMutation({
    mutationFn: () => {
      const values: { tipo_dia: TipoDia; intervalo: string; requeridos: number }[] = []
      for (const [key, val] of Object.entries(reqs)) {
        if (val > 0) {
          const colonIdx = key.indexOf(':')
          const tipo_dia = key.substring(0, colonIdx) as TipoDia
          const intervalo = key.substring(colonIdx + 1)
          values.push({ tipo_dia, intervalo, requeridos: val })
        }
      }
      return programacionApi.upsertRequeridos(progId, values)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programacion', progId] }),
  })

  const uploadReqsMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return programacionApi.uploadRequeridos(progId, fd)
    },
    onSuccess: (res) => {
      setUploadMsg(`Archivo cargado: ${res.data.total} requeridos importados`)
      qc.invalidateQueries({ queryKey: ['programacion', progId] })
    },
  })

  const saveFactorMut = useMutation({
    mutationFn: () => programacionApi.upsertFactor(progId, factor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programacion', progId] }),
  })

  const simMut = useMutation({
    mutationFn: () => programacionApi.simular(progId).then(r => r.data),
    onSuccess: (data) => {
      setSim(data)
      setTab('nomina')
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadReqsMut.mutate(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const totalReduccion = factor.deslogueo + factor.ausentismo + factor.rotacion

  if (isLoading) return <PageLoading />
  if (!prog) return <div className="p-6 text-gray-500">Programación no encontrada</div>

  const periodoLabel = `${MESES[prog.mes - 1]} ${prog.anio}${prog.semana > 0 ? ` · ${SEMANA_LABELS[prog.semana]}` : ''}`
  const hasReqs = (prog._count?.requeridos ?? (prog.requeridos?.length ?? 0)) > 0

  return (
    <div className="flex flex-col h-full">
      <Header
        title={prog.servicio.nombre}
        subtitle={periodoLabel}
        actions={
          <div className="flex items-center gap-2">
            {sim && (
              <button className="btn-secondary" onClick={handleExport}>
                <Download size={14} /> Exportar (4 hojas)
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => simMut.mutate()}
              disabled={simMut.isPending || !hasReqs}
              title={!hasReqs ? 'Configure los requeridos primero' : undefined}
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
        <div className="flex gap-0.5 mb-5 border-b border-gray-200 overflow-x-auto">
          {([
            { key: 'config', label: 'Configuración' },
            { key: 'nomina', label: 'Nómina', badge: sim?.stats.nomina_under },
            { key: 'simulacion', label: 'Simulación', badge: sim?.stats.sim_under },
            { key: 'movimientos', label: `Movimientos${sim ? ` (${sim.movimientos.length})` : ''}` },
            { key: 'feriados', label: `Cupos Feriado${sim ? ` (${sim.cupos_feriado.length})` : ''}` },
          ] as { key: typeof tab; label: string; badge?: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                tab === t.key ? 'border-konecta text-konecta' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── CONFIG TAB ── */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Requeridos table */}
            <div className="lg:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-gray-800">Requeridos por franja horaria</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cantidad de agentes necesarios por hora</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Excel upload */}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  <button
                    className="btn-secondary text-xs py-1.5 px-3"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadReqsMut.isPending}
                  >
                    <Upload size={12} /> {uploadReqsMut.isPending ? 'Subiendo…' : 'Cargar Excel'}
                  </button>
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    onClick={() => saveReqsMut.mutate()}
                    disabled={saveReqsMut.isPending}
                  >
                    <Save size={12} /> {saveReqsMut.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>

              {uploadMsg && (
                <p className="text-xs text-green-600 mb-3 flex items-center gap-1">
                  <CheckCircle size={12} /> {uploadMsg}
                </p>
              )}
              {uploadReqsMut.isError && (
                <p className="text-xs text-red-600 mb-3">{(uploadReqsMut.error as any)?.response?.data?.error}</p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium w-20">Hora</th>
                      {TIPO_DIA_COLS.map(td => (
                        <th key={td} className="text-center py-2 px-3 text-gray-600 font-semibold">{TIPO_DIA_LABELS[td]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORAS.map(hora => (
                      <tr key={hora} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1 pr-4 font-mono font-semibold text-gray-700">{hora}</td>
                        {TIPO_DIA_COLS.map(td => (
                          <td key={td} className="py-1 px-3 text-center">
                            <input
                              type="number" min={0} max={999}
                              className="w-16 text-center border border-gray-200 rounded-lg py-1 px-2 text-xs focus:ring-1 focus:ring-konecta focus:border-konecta"
                              value={reqs[`${td}:${hora}`] ?? ''}
                              placeholder="0"
                              onChange={e => {
                                const n = parseInt(e.target.value) || 0
                                setReqs(prev => ({ ...prev, [`${td}:${hora}`]: n }))
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {saveReqsMut.isSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle size={11} /> Guardado correctamente</p>}
              <p className="text-xs text-gray-400 mt-3">
                Los valores L-V/Sáb/Dom se expanden a cada fecha del período al guardar.
                También podés cargar un Excel en formato columnas=fechas / filas=horas.
              </p>
            </div>

            {/* Factor + info */}
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-800">Factor de reducción</p>
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    onClick={() => saveFactorMut.mutate()}
                    disabled={saveFactorMut.isPending}
                  >
                    <Save size={12} /> {saveFactorMut.isPending ? '…' : 'Guardar'}
                  </button>
                </div>
                {(['deslogueo', 'ausentismo', 'rotacion'] as const).map(f => (
                  <div key={f} className="mb-3">
                    <label className="label-base capitalize">{f}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={1} step={0.01}
                        className="input-base flex-1"
                        value={factor[f]}
                        onChange={e => setFactor(prev => ({ ...prev, [f]: parseFloat(e.target.value) || 0 }))}
                      />
                      <span className="text-xs text-gray-400 w-10 text-right">{(factor[f] * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 flex justify-between text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">{(totalReduccion * 100).toFixed(1)}%</span>
                </div>
                {saveFactorMut.isSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle size={11} /> Guardado</p>}
              </div>

              <div className="card p-4 bg-blue-50 border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-2">Algoritmo</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Días libres: rotación por contrato (24/30/35/36 hs)</li>
                  <li>• Cobertura neta = presentes × (1 - reductor)</li>
                  <li>• Movimientos: ±1h/±2h desde franjas con superávit</li>
                  <li>• Re-simulación valida que los movimientos no empeoran</li>
                  <li>• Cupos feriado: excedente en horarios clave</li>
                </ul>
              </div>

              {sim && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Agentes del servicio</p>
                  <p className="text-2xl font-bold text-gray-900">{sim.total_agentes}</p>
                  {sim.agentes_sin_ingreso > 0 && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} /> {sim.agentes_sin_ingreso} sin horario parseado
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NÓMINA TAB (baseline simulation) ── */}
        {(tab === 'nomina' || tab === 'simulacion') && (
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
                <p className="text-sm font-medium text-gray-500">Presioná "Simular" para calcular la cobertura</p>
              </div>
            )}

            {simMut.isPending && (
              <div className="card p-12 text-center">
                <div className="w-8 h-8 border-2 border-konecta border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Calculando cobertura y movimientos…</p>
              </div>
            )}

            {sim && (() => {
              const isNomina = tab === 'nomina'
              const currentSim = isNomina ? sim.nomina : sim.simulacion
              const stats = isNomina
                ? { under: sim.stats.nomina_under, ok: sim.stats.nomina_ok, over: sim.stats.nomina_over }
                : { under: sim.stats.sim_under, ok: sim.stats.sim_ok, over: sim.stats.sim_over }
              const total = stats.under + stats.ok + stats.over

              return (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="card p-4 text-center">
                      <Users size={16} className="mx-auto text-gray-400 mb-1" />
                      <p className="text-2xl font-bold text-gray-900">{sim.total_agentes}</p>
                      <p className="text-xs text-gray-500">Agentes activos</p>
                    </div>
                    <div className="card p-4 text-center border-red-200">
                      <XCircle size={16} className="mx-auto text-red-400 mb-1" />
                      <p className="text-2xl font-bold text-red-700">{stats.under}</p>
                      <p className="text-xs text-gray-500">UNDER ({total > 0 ? ((stats.under / total) * 100).toFixed(0) : 0}%)</p>
                    </div>
                    <div className="card p-4 text-center border-green-200">
                      <CheckCircle size={16} className="mx-auto text-green-500 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{stats.ok}</p>
                      <p className="text-xs text-gray-500">OK / LÍMITE</p>
                    </div>
                    <div className="card p-4 text-center border-blue-200">
                      <AlertTriangle size={16} className="mx-auto text-blue-400 mb-1" />
                      <p className="text-2xl font-bold text-blue-700">{stats.over}</p>
                      <p className="text-xs text-gray-500">OVER</p>
                    </div>
                  </div>

                  {/* Comparison badge for simulation tab */}
                  {!isNomina && sim.movimientos.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200 text-sm">
                      <ChevronRight size={14} className="text-green-600" />
                      <span className="text-green-800">
                        {sim.movimientos.length} movimientos aplicados · UNDER {sim.stats.nomina_under} → {sim.stats.sim_under}
                        {sim.stats.sim_under < sim.stats.nomina_under && <strong className="ml-1 text-green-700">(-{sim.stats.nomina_under - sim.stats.sim_under})</strong>}
                      </span>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    {[['bg-red-400', 'UNDER'], ['bg-orange-400', 'LÍMITE'], ['bg-green-400', 'OK'], ['bg-blue-400', 'OVER']].map(([bg, label]) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded ${bg}`} />{label}
                      </span>
                    ))}
                  </div>

                  {/* Coverage curve */}
                  <div className="card p-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Curva de cobertura (promedio por franja)</p>
                    <div className="flex gap-4 text-xs mb-2">
                      <span className="flex items-center gap-1"><span className="w-8 border-t-2 border-dashed border-red-400 inline-block" /> Requeridos</span>
                      <span className="flex items-center gap-1"><span className="w-8 border-t-2 border-green-500 inline-block" /> Asignados</span>
                    </div>
                    <CoverageCurve sim={currentSim} />
                  </div>

                  {/* Grid */}
                  <div className="card overflow-hidden">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Grilla de cobertura</p>
                      <p className="text-xs text-gray-400">{sim.fechas.length} días · {sim.intervalos.length} franjas</p>
                    </div>
                    <CoverageGrid sim={currentSim} intervalos={sim.intervalos} fechas={sim.fechas} />
                  </div>

                  {/* Interval summary */}
                  <div className="card p-5">
                    <p className="text-sm font-bold text-gray-800 mb-3">Resumen por franja horaria</p>
                    <div className="overflow-x-auto">
                      <IntervalSummary sim={currentSim} intervalos={sim.intervalos} />
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ── MOVIMIENTOS TAB ── */}
        {tab === 'movimientos' && (
          <div className="space-y-5">
            {!sim && <div className="card p-12 text-center"><p className="text-sm text-gray-400">Ejecutá la simulación primero</p></div>}
            {sim && sim.movimientos.length === 0 && (
              <div className="card p-10 text-center">
                <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
                <p className="text-sm font-medium text-gray-600">No se proponen movimientos</p>
                <p className="text-xs text-gray-400 mt-1">La cobertura actual no requiere ajustes de turno, o los movimientos empeoraban el resultado</p>
              </div>
            )}
            {sim && sim.movimientos.length > 0 && (
              <>
                <div className="card p-4 bg-amber-50 border-amber-200 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Se proponen <strong>{sim.movimientos.length}</strong> cambios de turno para reducir las franjas UNDER.
                    Estos son cambios <strong>permanentes</strong> de INGRESO, aplicados para todo el período.
                    La simulación post-movimiento ya validó que no empeoran la cobertura.
                  </span>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="table-th">#</th>
                        <th className="table-th">Agente</th>
                        <th className="table-th text-center">Turno actual</th>
                        <th className="table-th text-center w-8"></th>
                        <th className="table-th text-center">Turno propuesto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.movimientos.map((m, i) => (
                        <tr key={i} className="table-tr">
                          <td className="table-td text-gray-400 text-xs">{i + 1}</td>
                          <td className="table-td font-medium">{m.nombre}</td>
                          <td className="table-td text-center">
                            <span className="font-mono text-sm px-2 py-0.5 bg-gray-100 rounded">{m.de}</span>
                          </td>
                          <td className="table-td text-center text-gray-400">
                            <ArrowRight size={14} />
                          </td>
                          <td className="table-td text-center">
                            <span className="font-mono text-sm px-2 py-0.5 bg-green-100 text-green-800 rounded">{m.hacia}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CUPOS FERIADO TAB ── */}
        {tab === 'feriados' && (
          <div className="space-y-5">
            {!sim && <div className="card p-12 text-center"><p className="text-sm text-gray-400">Ejecutá la simulación primero</p></div>}
            {sim && sim.cupos_feriado.length === 0 && (
              <div className="card p-10 text-center">
                <Sun size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Sin cupos de feriado calculados</p>
                <p className="text-xs text-gray-400 mt-1">
                  Los cupos aparecen cuando hay agentes disponibles en horarios clave (06:00, 08:00–09:00, 14:00–19:00) con excedente ≥ 2 vs. el límite inferior
                </p>
              </div>
            )}
            {sim && sim.cupos_feriado.length > 0 && (
              <>
                <div className="card p-4 bg-sky-50 border-sky-200 text-xs text-sky-800">
                  Los cupos muestran cuántos agentes pueden tomar feriado en cada horario clave sin bajar del mínimo requerido (Límite Inferior). Solo se muestran segmentos con excedente ≥ 2.
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="table-th">Intervalo</th>
                        <th className="table-th">Isla / Segmento</th>
                        <th className="table-th text-right">Asignados</th>
                        <th className="table-th text-right">Cupos Feriado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.cupos_feriado.map((c, i) => (
                        <tr key={i} className="table-tr">
                          <td className="table-td font-mono font-semibold">{c.intervalo}</td>
                          <td className="table-td">{c.isla}</td>
                          <td className="table-td text-right">{c.asignados}</td>
                          <td className="table-td text-right">
                            <span className="font-bold text-sky-700 px-2 py-0.5 bg-sky-50 rounded">{c.cupo}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CalendarDays size={13} /> Horarios considerados para feriados
              </p>
              <div className="flex flex-wrap gap-2">
                {['06:00','08:00','09:00','14:00','15:00','17:00','18:00','19:00'].map(h => (
                  <span key={h} className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs text-gray-700">{h}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
