"use client";

import { useState, useMemo, useEffect, useRef, memo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, Play, Download, Upload, AlertTriangle, Users, CheckCircle,
  XCircle, ArrowRight, Sun, CalendarDays, ChevronRight, RefreshCw, Clock,
  CalendarOff, LayoutGrid, TrendingDown, TrendingUp, Minus, LineChart as LineChartIcon,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { programacionApi, nominasApi } from '@/lib/api'
import Header from '@/components/hr/layout/Header'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import { MESES } from '@/types'
import type { SimulacionResponse, SimulacionResultado, CronogramaResponse } from '@/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const min = Math.floor((Date.now() - date.getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEMANA_LABELS: Record<number, string> = { 0: 'Mes completo', 1: 'Sem 1', 2: 'Sem 2', 3: 'Sem 3', 4: 'Sem 4' }
const HORAS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
type TipoDia = 'SEMANA' | 'SABADO' | 'DOMINGO'
const TIPO_DIA_COLS: TipoDia[] = ['SEMANA', 'SABADO', 'DOMINGO']
const TIPO_DIA_LABELS: Record<TipoDia, string> = { SEMANA: 'L–V', SABADO: 'Sáb', DOMINGO: 'Dom' }

const ESTADO_CELL: Record<string, string> = {
  UNDER:  'bg-red-500 text-white',
  LIMITE: 'bg-orange-400 text-white',
  OK:     'bg-emerald-500 text-white',
  OVER:   'bg-blue-500 text-white',
}

const CONTRATO_BADGE: Record<string, string> = {
  '36HS': 'bg-violet-100 text-violet-700',
  '30HS': 'bg-blue-100 text-blue-700',
  '35HS': 'bg-cyan-100 text-cyan-700',
  '24HS': 'bg-amber-100 text-amber-700',
  'UNKNOWN': 'bg-gray-100 text-gray-500',
}

// ─── Recharts curva por franja (día seleccionado) ─────────────────────────────

const CUSTOM_TOOLTIP_FRANJA = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const req = payload.find((p: any) => p.dataKey === 'requeridos')?.value ?? 0
  const asig = payload.find((p: any) => p.dataKey === 'asignados')?.value ?? 0
  const diff = asig - req
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl border border-gray-700">
      <p className="font-bold text-gray-300 mb-1.5">{label}</p>
      <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Requeridos: <strong>{req}</strong></p>
      <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Asignados: <strong>{asig}</strong></p>
      <p className={`mt-1 font-semibold ${diff < 0 ? 'text-rose-400' : diff === 0 ? 'text-gray-300' : 'text-emerald-400'}`}>
        {diff >= 0 ? '+' : ''}{diff} agentes
      </p>
    </div>
  )
}

function CurvaFranjaChart({ sim, fecha, presencia }: {
  sim: SimulacionResultado[]
  fecha: string
  presencia?: { presentes: number; francos: number }
}) {
  const dayRows = useMemo(() =>
    sim.filter(r => r.fecha === fecha).sort((a, b) => a.intervalo.localeCompare(b.intervalo))
  , [sim, fecha])

  if (!dayRows.length) return (
    <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-400">
      <p className="text-sm font-medium text-gray-500">Sin requeridos configurados para este día</p>
      {presencia && (
        <div className="flex gap-6">
          <div className="text-center bg-emerald-50 rounded-2xl px-6 py-3">
            <p className="text-2xl font-black text-emerald-700">{presencia.presentes}</p>
            <p className="text-xs text-emerald-500 mt-0.5 font-medium">presentes</p>
          </div>
          <div className="text-center bg-gray-100 rounded-2xl px-6 py-3">
            <p className="text-2xl font-black text-gray-500">{presencia.francos}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">francos</p>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400">Configurá SÁBADO/DOMINGO en la tab Configuración para ver la curva</p>
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={dayRows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradAsig" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="intervalo" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={32} />
        <Tooltip content={<CUSTOM_TOOLTIP_FRANJA />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone" dataKey="requeridos" name="Requeridos"
          stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 3"
          fill="url(#gradReq)" dot={false} activeDot={{ r: 4 }}
        />
        <Area
          type="monotone" dataKey="asignados" name="Asignados"
          stroke="#10b981" strokeWidth={2.5}
          fill="url(#gradAsig)" dot={false} activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function CurvaDiariaChart({ sim, fechas, presencia }: {
  sim: SimulacionResultado[]
  fechas: { fecha: string; dia_num: number; dia_semana: string }[]
  presencia: Record<string, { presentes: number; francos: number }>
}) {
  const data = useMemo(() => {
    const byFecha = new Map<string, SimulacionResultado[]>()
    for (const r of sim) {
      const list = byFecha.get(r.fecha)
      if (list) list.push(r)
      else byFecha.set(r.fecha, [r])
    }
    return fechas.map(f => {
      const rows = byFecha.get(f.fecha) ?? []
      const hasReqs = rows.length > 0
      return {
        dia: `${f.dia_semana} ${f.dia_num}`,
        fecha: f.fecha,
        under:    hasReqs ? rows.filter(r => r.estado === 'UNDER').length : 0,
        limite:   hasReqs ? rows.filter(r => r.estado === 'LIMITE').length : 0,
        ok:       hasReqs ? rows.filter(r => r.estado === 'OK').length : 0,
        over:     hasReqs ? rows.filter(r => r.estado === 'OVER').length : 0,
        presentes: !hasReqs ? (presencia[f.fecha]?.presentes ?? 0) : 0,
      }
    })
  }, [sim, fechas, presencia])

  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} width={24} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb' }}
          cursor={{ fill: '#f9fafb' }}
        />
        <Bar dataKey="presentes" name="Presentes (sin req.)" stackId="a" fill="#d1d5db" radius={[3, 3, 0, 0]} />
        <Bar dataKey="under" name="UNDER" stackId="a" fill="#ef4444" />
        <Bar dataKey="limite" name="LÍMITE" stackId="a" fill="#f97316" />
        <Bar dataKey="ok" name="OK" stackId="a" fill="#10b981" />
        <Bar dataKey="over" name="OVER" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Coverage curve ────────────────────────────────────────────────────────────

const CoverageCurve = memo(function CoverageCurve({ sim }: { sim: SimulacionResultado[] }) {
  const points = useMemo(() => {
    const byIntervalo = new Map<string, { asig: number[]; req: number[] }>()
    for (const r of sim) {
      if (!byIntervalo.has(r.intervalo)) byIntervalo.set(r.intervalo, { asig: [], req: [] })
      byIntervalo.get(r.intervalo)!.asig.push(r.asignados)
      byIntervalo.get(r.intervalo)!.req.push(r.requeridos)
    }
    return [...byIntervalo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([intv, d]) => ({
      intv,
      asig: d.asig.reduce((s, v) => s + v, 0) / d.asig.length,
      req: d.req.reduce((s, v) => s + v, 0) / d.req.length,
    }))
  }, [sim])
  if (points.length < 2) return null

  const W = 600, H = 160, PAD = 40
  const maxVal = Math.max(...points.flatMap(p => [p.asig, p.req]), 1)
  const scaleX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const scaleY = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2)
  const polyline = (vals: number[]) => vals.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 150 }}>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PAD} y1={scaleY(maxVal * pct)} x2={W - PAD} y2={scaleY(maxVal * pct)}
          stroke="#f3f4f6" strokeWidth={1} />
      ))}
      <polyline points={polyline(points.map(p => p.req))}
        fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
      <polyline points={polyline(points.map(p => p.asig))}
        fill="none" stroke="#10b981" strokeWidth={2.5} />
      {points.filter((_, i) => i % 2 === 0).map((p, i) => (
        <text key={i} x={scaleX(i * 2)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">{p.intv}</text>
      ))}
    </svg>
  )
})

// ─── Coverage grid ─────────────────────────────────────────────────────────────

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
              <th className="sticky left-0 bg-gray-800 text-white z-10 px-3 py-2.5 text-left font-semibold border-b border-gray-700 min-w-[60px] rounded-tl-lg">Hora</th>
              {fechas.map(f => (
                <th key={f.fecha} className={`px-0.5 py-2.5 text-center border-b border-gray-100 min-w-[34px] ${f.dia_semana === 'Sáb' || f.dia_semana === 'Dom' ? 'bg-gray-50' : ''}`}>
                  <div className="text-[9px] text-gray-400">{f.dia_semana}</div>
                  <div className="font-bold text-gray-700 text-[11px]">{f.dia_num}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {intervalos.map(intv => (
              <tr key={intv} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white z-10 px-3 py-0.5 font-mono font-bold text-gray-700 border-r border-gray-100 text-[11px]">{intv}</td>
                {fechas.map(f => {
                  const cell = cellMap.get(intv)?.get(f.fecha)
                  if (!cell) return <td key={f.fecha} className="px-0.5 py-0.5"><div className="w-7 h-5 rounded mx-auto bg-gray-50" /></td>
                  const ratio = cell.requeridos > 0 ? cell.asignados / cell.requeridos : 1
                  const intensity = Math.min(ratio, 2)
                  return (
                    <td key={f.fecha} className="px-0.5 py-0.5 cursor-pointer"
                      onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, data: cell })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className={`w-7 h-5 rounded mx-auto flex items-center justify-center text-[9px] font-bold ${ESTADO_CELL[cell.estado] ?? 'bg-gray-200 text-gray-700'}`}
                        style={{ opacity: 0.6 + intensity * 0.2 }}>
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
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded-2xl p-4 shadow-2xl pointer-events-none max-w-xs border border-gray-700"
          style={{ left: tooltip.x + 14, top: tooltip.y - 12 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ESTADO_CELL[tooltip.data.estado]}`}>
              {tooltip.data.estado}
            </span>
            <span className="text-gray-300 text-[10px]">{tooltip.data.fecha} · {tooltip.data.intervalo}</span>
          </div>
          <div className="flex gap-4 mb-2 text-[11px]">
            <span>Asig: <strong className="text-white">{tooltip.data.asignados}</strong></span>
            <span>Req: <strong className="text-white">{tooltip.data.requeridos}</strong></span>
            <span>L.Inf: <strong className="text-white">{(tooltip.data as any).limite_inferior ?? '—'}</strong></span>
          </div>
          {tooltip.data.agentes?.length > 0 && (
            <div className="border-t border-gray-700 pt-2 max-h-36 overflow-y-auto">
              <p className="text-gray-500 mb-1 text-[10px]">{tooltip.data.agentes.length} presentes</p>
              {tooltip.data.agentes.slice(0, 8).map((a, i) => <p key={i} className="truncate text-[10px] text-gray-300">{a}</p>)}
              {tooltip.data.agentes.length > 8 && <p className="text-gray-500 text-[10px]">+{tooltip.data.agentes.length - 8} más</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Interval summary ──────────────────────────────────────────────────────────

const IntervalSummary = memo(function IntervalSummary({ sim, intervalos }: { sim: SimulacionResultado[]; intervalos: string[] }) {
  const rows = useMemo(() => {
    const byIntervalo = new Map<string, SimulacionResultado[]>()
    for (const r of sim) {
      const list = byIntervalo.get(r.intervalo)
      if (list) list.push(r)
      else byIntervalo.set(r.intervalo, [r])
    }
    const avg = (arr: number[]) => arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '—'
    return intervalos.map(intv => {
      const cells = byIntervalo.get(intv) ?? []
      return {
        intv,
        avgAsig: avg(cells.map(c => c.asignados)),
        avgReq: avg(cells.map(c => c.requeridos)),
        UNDER: cells.filter(c => c.estado === 'UNDER').length,
        LIMITE: cells.filter(c => c.estado === 'LIMITE').length,
        OK: cells.filter(c => c.estado === 'OK').length,
        OVER: cells.filter(c => c.estado === 'OVER').length,
      }
    })
  }, [sim, intervalos])

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b-2 border-gray-100">
          <th className="text-left py-2.5 pr-4 text-gray-500 font-semibold text-[11px] uppercase tracking-wide">Franja</th>
          <th className="text-right py-2.5 text-gray-500 font-semibold text-[11px] uppercase tracking-wide">Prom. Asig</th>
          <th className="text-right py-2.5 text-gray-500 font-semibold text-[11px] uppercase tracking-wide">Prom. Req</th>
          <th className="text-center py-2.5 text-red-500 font-semibold text-[11px] uppercase tracking-wide">UNDER</th>
          <th className="text-center py-2.5 text-orange-500 font-semibold text-[11px] uppercase tracking-wide">LÍMITE</th>
          <th className="text-center py-2.5 text-emerald-600 font-semibold text-[11px] uppercase tracking-wide">OK</th>
          <th className="text-center py-2.5 text-blue-500 font-semibold text-[11px] uppercase tracking-wide">OVER</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.intv} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <td className="py-2 pr-4 font-mono font-bold text-gray-800 text-[11px]">{r.intv}</td>
            <td className="py-2 text-right text-gray-600 tabular-nums">{r.avgAsig}</td>
            <td className="py-2 text-right text-gray-600 tabular-nums">{r.avgReq}</td>
            <td className="py-2 text-center">{r.UNDER > 0 ? <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{r.UNDER}</span> : <span className="text-gray-200">—</span>}</td>
            <td className="py-2 text-center">{r.LIMITE > 0 ? <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{r.LIMITE}</span> : <span className="text-gray-200">—</span>}</td>
            <td className="py-2 text-center">{r.OK > 0 ? <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{r.OK}</span> : <span className="text-gray-200">—</span>}</td>
            <td className="py-2 text-center">{r.OVER > 0 ? <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{r.OVER}</span> : <span className="text-gray-200">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProgramacionDetalle() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const qc = useQueryClient()
  const progId = parseInt(id!)
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'config' | 'nomina' | 'simulacion' | 'movimientos' | 'feriados' | 'cronograma' | 'curvas'>('config')
  const [curvaFecha, setCurvaFecha] = useState<string | null>(null)
  const [reqs, setReqs] = useState<Record<string, number>>({})
  const [factor, setFactor] = useState({ deslogueo: 0, ausentismo: 0, rotacion: 0 })
  const [sim, setSim] = useState<SimulacionResponse | null>(null)
  const [simTimestamp, setSimTimestamp] = useState<Date | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [sheetModal, setSheetModal] = useState<{ file: File; sheets: string[]; selected: string[] } | null>(null)

  const CACHE_KEY = `prog_sim_${progId}`
  const CACHE_TTL = 24 * 60 * 60 * 1000

  const { data: prog, isLoading } = useQuery({
    queryKey: ['programacion', progId],
    queryFn: () => programacionApi.get(progId).then(r => r.data),
  })

  const { data: nominasDisponibles = [] } = useQuery({
    queryKey: ['nominas', prog?.servicio_id],
    queryFn: () => nominasApi.list({ servicio_id: prog!.servicio_id }).then(r => r.data),
    enabled: !!prog?.servicio_id,
  })

  const { data: cronograma, isLoading: cronogramaLoading } = useQuery({
    queryKey: ['programacion-cronograma', progId],
    queryFn: () => programacionApi.cronograma(progId).then(r => r.data),
    enabled: tab === 'cronograma',
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!prog) return
    if (prog.factor) setFactor({ deslogueo: prog.factor.deslogueo, ausentismo: prog.factor.ausentismo, rotacion: prog.factor.rotacion })
    const map: Record<string, number> = {}
    for (const r of prog.requeridos ?? []) {
      const dow = new Date(r.fecha + 'T12:00:00').getDay()
      const tipoDia: TipoDia = dow === 0 ? 'DOMINGO' : dow === 6 ? 'SABADO' : 'SEMANA'
      const key = `${tipoDia}:${r.intervalo}`
      if (!map[key]) map[key] = r.requeridos
    }
    setReqs(map)
  }, [prog])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return
      const { data, timestamp } = JSON.parse(raw) as { data: SimulacionResponse; timestamp: string }
      if (Date.now() - new Date(timestamp).getTime() < CACHE_TTL) {
        setSim(data)
        setSimTimestamp(new Date(timestamp))
        setTab('nomina')
      } else localStorage.removeItem(CACHE_KEY)
    } catch { localStorage.removeItem(CACHE_KEY) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CACHE_KEY])

  const saveReqsMut = useMutation({
    mutationFn: () => {
      const values: { tipo_dia: TipoDia; intervalo: string; requeridos: number }[] = []
      for (const [key, val] of Object.entries(reqs)) {
        if (val > 0) {
          const colonIdx = key.indexOf(':')
          values.push({ tipo_dia: key.substring(0, colonIdx) as TipoDia, intervalo: key.substring(colonIdx + 1), requeridos: val })
        }
      }
      return programacionApi.upsertRequeridos(progId, values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programacion', progId] })
      localStorage.removeItem(CACHE_KEY)
      setSim(null)
      setSimTimestamp(null)
    },
  })

  const previewReqsMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return programacionApi.previewRequeridos(progId, fd)
    },
    onSuccess: (res, file) => {
      const sheets = res.data.sheets
      if (sheets.length <= 1) {
        // Single sheet: upload directly
        uploadReqsMut.mutate({ file, sheets })
      } else {
        setSheetModal({ file, sheets, selected: sheets })
      }
    },
  })

  const uploadReqsMut = useMutation({
    mutationFn: ({ file, sheets }: { file: File; sheets: string[] }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('sheets', JSON.stringify(sheets))
      return programacionApi.uploadRequeridos(progId, fd)
    },
    onSuccess: (res) => {
      setUploadMsg(`${res.data.total} requeridos importados`)
      setSheetModal(null)
      qc.invalidateQueries({ queryKey: ['programacion', progId] })
      localStorage.removeItem(CACHE_KEY)
      setSim(null)
      setSimTimestamp(null)
    },
  })

  const saveFactorMut = useMutation({
    mutationFn: () => programacionApi.upsertFactor(progId, factor),
    onSuccess: () => {
      // Patch factor in cache directly — avoids reloading all requeridos
      qc.setQueryData(['programacion', progId], (old: any) =>
        old ? { ...old, factor: { ...factor, id: old.factor?.id ?? 0, programacion_id: progId } } : old
      )
      localStorage.removeItem(CACHE_KEY)
      setSim(null)
      setSimTimestamp(null)
    },
  })

  const setNominaMut = useMutation({
    mutationFn: (nominaId: number | null) => programacionApi.setNomina(progId, nominaId),
    onSuccess: (res) => {
      // Patch the cache directly with the mutation response (which has updated nomina_id/nomina)
      // without triggering a full refetch that would reload all requeridos (can be 1000+ rows)
      qc.setQueryData(['programacion', progId], (old: any) => ({
        ...res.data,
        requeridos: old?.requeridos ?? [],
      }))
      // Cronograma uses nomina data — invalidate so it refetches with new agents
      qc.invalidateQueries({ queryKey: ['programacion-cronograma', progId] })
      localStorage.removeItem(CACHE_KEY)
      setSim(null)
      setSimTimestamp(null)
    },
  })

  const simMut = useMutation({
    mutationFn: () => programacionApi.simular(progId).then(r => r.data),
    onSuccess: (data) => {
      const now = new Date()
      setSim(data)
      setSimTimestamp(now)
      if (tab === 'config') setTab('nomina')
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: now.toISOString() })) } catch { /* full */ }
    },
  })

  function downloadBlob(data: BlobPart, filename: string) {
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExport() { programacionApi.export(progId).then(r => downloadBlob(r.data, `programacion_${prog?.servicio.nombre}_${prog?.mes}_${prog?.anio}.xlsx`)) }
  function handleExportFrancos() { programacionApi.exportFrancos(progId).then(r => downloadBlob(r.data, `francos_${prog?.servicio.nombre}_${prog?.mes}_${prog?.anio}.xlsx`)) }
  function handleExportConversor() { programacionApi.exportConversor(progId).then(r => downloadBlob(r.data, `conversor_${prog?.servicio.nombre}_${prog?.mes}_${prog?.anio}.xlsx`)) }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) previewReqsMut.mutate(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const totalReduccion = factor.deslogueo + factor.ausentismo + factor.rotacion

  if (isLoading) return <PageLoading />
  if (!prog) return <div className="p-6 text-gray-500">Programación no encontrada</div>

  const periodoLabel = `${MESES[prog.mes - 1]} ${prog.anio}${prog.semana > 0 ? ` · ${SEMANA_LABELS[prog.semana]}` : ''}`
  const hasReqs = (prog._count?.requeridos ?? (prog.requeridos?.length ?? 0)) > 0

  const TABS = [
    { key: 'config' as const, label: 'Configuración' },
    { key: 'cronograma' as const, label: 'Cronograma' },
    { key: 'nomina' as const, label: 'Nómina', badge: sim?.stats.nomina_under },
    { key: 'simulacion' as const, label: 'Simulación', badge: sim?.stats.sim_under },
    { key: 'curvas' as const, label: 'Curvas', badge: undefined },
    { key: 'movimientos' as const, label: 'Movimientos', badge: sim?.movimientos.length },
    { key: 'feriados' as const, label: 'Cupos Feriado', badge: sim?.cupos_feriado.length },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Programación"
        subtitle={`${prog.servicio.nombre} · ${periodoLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={handleExportFrancos} title="Exportar francos">
              <CalendarOff size={14} /> Francos
            </button>
            <button className="btn-secondary" onClick={handleExportConversor} title="Exportar conversor">
              <LayoutGrid size={14} /> Conversor
            </button>
            {sim && (
              <button className="btn-secondary" onClick={handleExport}>
                <Download size={14} /> Exportar
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => simMut.mutate()}
              disabled={simMut.isPending || !hasReqs}
              title={!hasReqs ? 'Configure los requeridos primero' : undefined}
            >
              <Play size={14} />
              {simMut.isPending ? 'Calculando…' : 'Simular'}
            </button>
            <button className="btn-secondary" onClick={() => router.push('/programacion')}>
              <ArrowLeft size={14} /> Volver
            </button>
          </div>
        }
      />

      {/* Barra de color del servicio */}
      <div className="h-1 shrink-0" style={{ backgroundColor: prog.servicio.color }} />

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-gray-100 rounded-2xl overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none ${
                  tab === t.key ? 'bg-red-100 text-red-600' : 'bg-red-500 text-white'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Sim timestamp */}
        {simTimestamp && (
          <div className="flex items-center gap-2 mb-5 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
            <Clock size={11} />
            <span>Última simulación: <span className="font-semibold text-gray-600">{timeAgo(simTimestamp)}</span></span>
            <button
              className="ml-auto flex items-center gap-1.5 text-konecta hover:text-konecta/80 font-semibold transition-colors"
              onClick={() => simMut.mutate()}
              disabled={simMut.isPending}
            >
              <RefreshCw size={11} className={simMut.isPending ? 'animate-spin' : ''} />
              Re-simular
            </button>
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Requeridos */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-bold text-gray-900">Requeridos por franja</p>
                  <p className="text-xs text-gray-400 mt-0.5">Agentes necesarios por hora y tipo de día</p>
                </div>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => fileRef.current?.click()} disabled={previewReqsMut.isPending || uploadReqsMut.isPending}>
                    <Upload size={12} /> {previewReqsMut.isPending ? 'Leyendo…' : uploadReqsMut.isPending ? 'Subiendo…' : 'Excel'}
                  </button>
                  <button className="btn-primary text-xs py-1.5 px-3" onClick={() => saveReqsMut.mutate()} disabled={saveReqsMut.isPending}>
                    <Save size={12} /> {saveReqsMut.isPending ? '…' : 'Guardar'}
                  </button>
                </div>
              </div>

              {uploadMsg && (
                <div className="mx-5 mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                  <CheckCircle size={12} /> {uploadMsg}
                </div>
              )}
              {(uploadReqsMut.isError || previewReqsMut.isError) && (
                <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  {(uploadReqsMut.error as any)?.response?.data?.error ?? (previewReqsMut.error as any)?.response?.data?.error ?? 'Error al procesar archivo'}
                </div>
              )}

              <div className="overflow-x-auto px-5 pb-5 pt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-4 text-gray-500 font-semibold text-[11px] uppercase tracking-wide w-20">Hora</th>
                      {TIPO_DIA_COLS.map(td => (
                        <th key={td} className="text-center py-2 px-4 text-gray-700 font-bold text-[11px] uppercase tracking-wide">
                          {TIPO_DIA_LABELS[td]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORAS.map(hora => (
                      <tr key={hora} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-4 font-mono font-bold text-gray-700 text-[11px]">{hora}</td>
                        {TIPO_DIA_COLS.map(td => {
                          const val = reqs[`${td}:${hora}`] ?? 0
                          const bgAlpha = val > 0 ? Math.min(val / 25, 1) * 0.25 + 0.06 : 0
                          return (
                            <td key={td} className="py-1.5 px-4 text-center">
                              <input
                                type="number" min={0} max={999}
                                className="w-16 text-center border border-gray-200 rounded-lg py-1 px-2 text-xs focus:ring-1 focus:ring-konecta focus:border-konecta outline-none transition-colors"
                                style={{ backgroundColor: val > 0 ? `rgba(16,185,129,${bgAlpha})` : undefined }}
                                value={val || ''}
                                placeholder="0"
                                onChange={e => {
                                  const n = parseInt(e.target.value) || 0
                                  setReqs(prev => ({ ...prev, [`${td}:${hora}`]: n }))
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {saveReqsMut.isSuccess && (
                  <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1.5">
                    <CheckCircle size={11} /> Guardado correctamente
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  Los valores L-V/Sáb/Dom se expanden a cada fecha del período al guardar. También podés cargar un Excel en formato Workforce.
                </p>
              </div>
            </div>

            {/* Sidebar derecha */}
            <div className="space-y-4">

              {/* Nómina base */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-900 mb-1">Nómina base</p>
                <p className="text-xs text-gray-400 mb-3">Agentes que se usan en la simulación</p>
                <select
                  className="input-base w-full mb-3 text-sm"
                  value={prog.nomina_id ?? ''}
                  onChange={e => setNominaMut.mutate(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={setNominaMut.isPending}
                >
                  <option value="">Agentes activos del servicio</option>
                  {nominasDisponibles.map(n => (
                    <option key={n.id} value={n.id}>
                      {MESES[n.mes - 1]} {n.anio} · {n.total_agentes} ag. ({n.estado})
                    </option>
                  ))}
                </select>
                {prog.nomina ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
                    <CheckCircle size={11} />
                    <span>Nómina <strong>{MESES[prog.nomina.mes - 1]} {prog.nomina.anio}</strong> · {prog.nomina.total_agentes} agentes</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5">
                    <Users size={11} />
                    <span>Agentes activos del servicio</span>
                  </div>
                )}
              </div>

              {/* Factor de reducción */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-bold text-gray-900">Factor de reducción</p>
                  <button className="btn-primary text-xs py-1.5 px-3" onClick={() => saveFactorMut.mutate()} disabled={saveFactorMut.isPending}>
                    <Save size={11} /> {saveFactorMut.isPending ? '…' : 'Guardar'}
                  </button>
                </div>
                {(['deslogueo', 'ausentismo', 'rotacion'] as const).map(f => {
                  const pct = Math.round(factor[f] * 100)
                  return (
                    <div key={f} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-600 capitalize">{f}</label>
                        <span className="text-sm font-black text-gray-900 tabular-nums">{pct}%</span>
                      </div>
                      <input
                        type="range" min={0} max={30} step={1}
                        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-konecta"
                        value={pct}
                        onChange={e => setFactor(prev => ({ ...prev, [f]: parseInt(e.target.value) / 100 }))}
                      />
                    </div>
                  )
                })}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">Total</span>
                    <span className="text-base font-black text-gray-900">{(totalReduccion * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(totalReduccion * 100 / 30, 100)}%`,
                        backgroundColor: totalReduccion > 0.2 ? '#ef4444' : totalReduccion > 0.1 ? '#f97316' : '#10b981',
                      }}
                    />
                  </div>
                </div>
                {saveFactorMut.isSuccess && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle size={11} /> Guardado</p>}
              </div>

              {/* Algoritmo */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
                <p className="text-sm font-bold mb-3">Algoritmo</p>
                <ul className="text-xs space-y-2 text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-konecta mt-0.5">›</span> Días libres por contrato (24/30/35/36 hs)</li>
                  <li className="flex items-start gap-2"><span className="text-konecta mt-0.5">›</span> Lógica especial dominical (prioriza 36HS)</li>
                  <li className="flex items-start gap-2"><span className="text-konecta mt-0.5">›</span> Bandas dinámicas: req&lt;10 ±1, req&lt;20 ±2, req≥20 ±10%</li>
                  <li className="flex items-start gap-2"><span className="text-konecta mt-0.5">›</span> Movimientos ±1h/±2h para reducir UNDER</li>
                  <li className="flex items-start gap-2"><span className="text-konecta mt-0.5">›</span> Cupos feriado en horarios clave</li>
                </ul>
              </div>

              {sim && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm font-bold text-gray-900 mb-3">Agentes simulados</p>
                  <p className="text-4xl font-black text-gray-900">{sim.total_agentes}</p>
                  {sim.agentes_sin_ingreso > 0 && (
                    <p className="text-xs text-orange-500 mt-2 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> {sim.agentes_sin_ingreso} sin horario parseado
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CRONOGRAMA ── */}
        {tab === 'cronograma' && (
          <div className="space-y-4">
            {cronogramaLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-konecta border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Cargando cronograma…</p>
              </div>
            )}
            {cronograma && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 text-center">
                      <p className="text-xl font-black text-gray-900">{cronograma.total}</p>
                      <p className="text-[10px] text-gray-400 font-medium">agentes</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 text-center">
                      <p className="text-xl font-black text-gray-900">{cronograma.dates.length}</p>
                      <p className="text-[10px] text-gray-400 font-medium">días</p>
                    </div>
                  </div>
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={handleExportConversor}>
                    <Download size={12} /> Exportar Excel
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                    <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
                      <thead>
                        <tr>
                          <th className="sticky left-0 top-0 z-30 bg-gray-900 text-white px-4 py-3 text-left border-r border-gray-700 whitespace-nowrap font-semibold text-[11px] uppercase tracking-wide" style={{ minWidth: 200 }}>Agente</th>
                          <th className="sticky top-0 z-20 bg-gray-900 text-white px-3 py-3 text-center border-r border-gray-700 font-semibold text-[11px] uppercase tracking-wide" style={{ minWidth: 62 }}>Cto.</th>
                          <th className="sticky top-0 z-20 bg-gray-900 text-white px-3 py-3 text-center border-r border-gray-700 font-semibold text-[11px] uppercase tracking-wide" style={{ minWidth: 62 }}>Ingreso</th>
                          <th className="sticky top-0 z-20 bg-gray-900 text-white px-3 py-3 text-center border-r border-gray-700 font-semibold text-[11px] uppercase tracking-wide" style={{ minWidth: 62 }}>Break</th>
                          <th className="sticky top-0 z-20 bg-gray-900 text-white px-4 py-3 text-left border-r border-gray-700 font-semibold text-[11px] uppercase tracking-wide" style={{ minWidth: 120 }}>Francos</th>
                          {cronograma.dates.map(d => (
                            <th key={d.fecha}
                              className={`sticky top-0 z-20 text-white px-1 py-3 text-center border-r border-gray-700 ${d.dow === 0 || d.dow === 6 ? 'bg-gray-700' : 'bg-gray-800'}`}
                              style={{ minWidth: 44 }}
                            >
                              <div className="text-[9px] font-normal opacity-60">{d.dia_semana}</div>
                              <div className="font-bold text-[12px]">{d.dia_num}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cronograma.agents.map((a, i) => (
                          <tr key={a.id} className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                            <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-semibold text-gray-800 border-r border-gray-100 whitespace-nowrap text-[11px]">{a.nombre}</td>
                            <td className="px-3 py-2 text-center border-r border-gray-100">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${CONTRATO_BADGE[a.contratoNorm] ?? 'bg-gray-100 text-gray-500'}`}>
                                {a.contratoNorm === 'UNKNOWN' ? (a.contrato ?? '?') : a.contratoNorm}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-[11px] text-gray-700 border-r border-gray-100 font-bold">{a.ingreso ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-mono text-[11px] text-gray-400 border-r border-gray-100">{a.hora_break ?? '—'}</td>
                            <td className="px-4 py-2 text-[10px] text-gray-500 border-r border-gray-100 whitespace-nowrap">{a.francos.join(', ')}</td>
                            {cronograma.dates.map(d => {
                              const val = a.dias[d.fecha]
                              const isFranco = val === 'F'
                              return (
                                <td key={d.fecha}
                                  className={`py-2 text-center border-r border-gray-100 ${isFranco ? 'bg-gray-100' : d.dow === 0 || d.dow === 6 ? 'bg-slate-50' : ''}`}
                                >
                                  {isFranco
                                    ? <span className="font-black text-gray-400 text-[10px]">F</span>
                                    : <span className="font-mono text-[10px] font-semibold text-emerald-700">{val}</span>
                                  }
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                          <td className="sticky left-0 bg-emerald-50 px-4 py-2 font-bold text-emerald-800 border-r border-emerald-200 text-xs" colSpan={5}>Presentes</td>
                          {cronograma.dates.map(d => {
                            const count = cronograma.agents.filter(a => a.dias[d.fecha] !== 'F' && a.dias[d.fecha] !== '—').length
                            return <td key={d.fecha} className="py-2 text-center font-black text-emerald-700 text-[11px] border-r border-emerald-100">{count}</td>
                          })}
                        </tr>
                        <tr className="bg-gray-100 border-t border-gray-200">
                          <td className="sticky left-0 bg-gray-100 px-4 py-2 font-bold text-gray-600 border-r border-gray-200 text-xs" colSpan={5}>Francos</td>
                          {cronograma.dates.map(d => {
                            const count = cronograma.agents.filter(a => a.dias[d.fecha] === 'F').length
                            return <td key={d.fecha} className="py-2 text-center font-black text-gray-500 text-[11px] border-r border-gray-200">{count}</td>
                          })}
                        </tr>
                        <tr className="bg-sky-50 border-t border-sky-200">
                          <td className="sticky left-0 bg-sky-50 px-4 py-2 font-bold text-sky-800 border-r border-sky-200 text-xs" colSpan={5}>Req. pico</td>
                          {cronograma.dates.map(d => {
                            const req = cronograma.requeridos_pico?.[d.fecha] ?? 0
                            return <td key={d.fecha} className="py-2 text-center font-black text-sky-700 text-[11px] border-r border-sky-100">{req > 0 ? req : '—'}</td>
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── NÓMINA / SIMULACIÓN ── */}
        {(tab === 'nomina' || tab === 'simulacion') && (
          <div className="space-y-5">
            {simMut.isError && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl text-sm text-red-700 border border-red-200">
                <AlertTriangle size={16} className="shrink-0" />
                {(simMut.error as any)?.response?.data?.error ?? 'Error al simular'}
              </div>
            )}

            {!sim && !simMut.isPending && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
                  <Play size={32} className="text-gray-300" />
                </div>
                <p className="text-base font-semibold text-gray-500">Presioná "Simular" para calcular la cobertura</p>
                <button
                  className="btn-primary"
                  onClick={() => simMut.mutate()}
                  disabled={!hasReqs}
                >
                  <Play size={14} /> Simular ahora
                </button>
              </div>
            )}

            {simMut.isPending && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 border-3 border-konecta border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-500">Calculando cobertura y movimientos…</p>
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
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agentes</span>
                        <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Users size={14} className="text-gray-500" />
                        </div>
                      </div>
                      <p className="text-4xl font-black text-gray-900">{sim.total_agentes}</p>
                      <p className="text-[11px] text-gray-400 mt-1">activos en período</p>
                    </div>

                    <div className="bg-red-50 rounded-2xl border border-red-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">UNDER</span>
                        <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                          <TrendingDown size={14} className="text-red-500" />
                        </div>
                      </div>
                      <p className="text-4xl font-black text-red-700">{stats.under}</p>
                      <p className="text-[11px] text-red-400 mt-1">
                        franjas con déficit · {total > 0 ? Math.round(stats.under / total * 100) : 0}%
                      </p>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">OK / LÍMITE</span>
                        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <CheckCircle size={14} className="text-emerald-500" />
                        </div>
                      </div>
                      <p className="text-4xl font-black text-emerald-700">{stats.ok}</p>
                      <p className="text-[11px] text-emerald-500 mt-1">
                        franjas en rango · {total > 0 ? Math.round(stats.ok / total * 100) : 0}%
                      </p>
                    </div>

                    <div className="bg-blue-50 rounded-2xl border border-blue-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">OVER</span>
                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                          <TrendingUp size={14} className="text-blue-500" />
                        </div>
                      </div>
                      <p className="text-4xl font-black text-blue-700">{stats.over}</p>
                      <p className="text-[11px] text-blue-400 mt-1">
                        franjas con exceso · {total > 0 ? Math.round(stats.over / total * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Banner movimientos */}
                  {!isNomina && sim.movimientos.length > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <ChevronRight size={16} className="text-emerald-600" />
                      </div>
                      <div className="text-sm text-emerald-800">
                        <strong>{sim.movimientos.length}</strong> movimientos aplicados ·
                        UNDER <strong>{sim.stats.nomina_under}</strong> → <strong>{sim.stats.sim_under}</strong>
                        {sim.stats.sim_under < sim.stats.nomina_under && (
                          <span className="ml-2 text-emerald-600 font-bold">
                            ↓ {sim.stats.nomina_under - sim.stats.sim_under} franjas mejoradas
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Leyenda */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    {[['bg-red-500', 'UNDER', 'Déficit de cobertura'],
                      ['bg-orange-400', 'LÍMITE', 'En el límite inferior'],
                      ['bg-emerald-500', 'OK', 'Dentro del rango'],
                      ['bg-blue-500', 'OVER', 'Exceso de cobertura']
                    ].map(([bg, label, desc]) => (
                      <span key={label} className="flex items-center gap-2 text-gray-600">
                        <span className={`w-3 h-3 rounded-sm ${bg}`} />
                        <span className="font-semibold">{label}</span>
                        <span className="text-gray-400 hidden sm:inline">{desc}</span>
                      </span>
                    ))}
                  </div>

                  {/* Curva de cobertura */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-bold text-gray-900 mb-3">Curva de cobertura promedio</p>
                    <div className="flex gap-5 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-2"><span className="w-8 border-t-2 border-dashed border-red-400 inline-block" /> Requeridos</span>
                      <span className="flex items-center gap-2"><span className="w-8 border-t-2 border-emerald-500 inline-block" /> Asignados</span>
                    </div>
                    <CoverageCurve sim={currentSim} />
                  </div>

                  {/* Grilla de cobertura */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">Grilla de cobertura</p>
                      <p className="text-xs text-gray-400">{sim.fechas.length} días · {sim.intervalos.length} franjas</p>
                    </div>
                    <div className="p-2">
                      <CoverageGrid sim={currentSim} intervalos={sim.intervalos} fechas={sim.fechas} />
                    </div>
                  </div>

                  {/* Resumen por franja */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-bold text-gray-900 mb-4">Resumen por franja horaria</p>
                    <div className="overflow-x-auto">
                      <IntervalSummary sim={currentSim} intervalos={sim.intervalos} />
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ── CURVAS ── */}
        {tab === 'curvas' && (() => {
          if (!sim) return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <LineChartIcon size={36} className="text-gray-200" />
              <p className="text-sm font-semibold">Ejecutá la simulación primero</p>
              <button className="btn-primary mt-1" onClick={() => simMut.mutate()} disabled={simMut.isPending || !hasReqs}>
                <Play size={13} /> Simular
              </button>
            </div>
          )

          const activeFecha = curvaFecha ?? sim.fechas[0]?.fecha ?? null
          const simData = sim.simulacion
          const presencia = sim.presencia_por_fecha ?? {}

          return (
            <div className="space-y-5">

              {/* Resumen diario — barras apiladas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-900 mb-1">Cobertura por día</p>
                <p className="text-xs text-gray-400 mb-4">Franjas en UNDER / LÍMITE / OK / OVER · gris = sin requeridos</p>
                <CurvaDiariaChart sim={simData} fechas={sim.fechas} presencia={presencia} />
              </div>

              {/* Selector de día */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Curva de franja</p>
                    <p className="text-xs text-gray-400 mt-0.5">Requeridos vs asignados por intervalo horario</p>
                  </div>
                  {activeFecha && (
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                      {sim.fechas.find(f => f.fecha === activeFecha)?.dia_semana} {sim.fechas.find(f => f.fecha === activeFecha)?.dia_num}
                    </span>
                  )}
                </div>

                {/* Botones de día */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {sim.fechas.map(f => {
                    const dayRows = simData.filter(r => r.fecha === f.fecha)
                    const hasUnder = dayRows.some(r => r.estado === 'UNDER')
                    const isActive = f.fecha === activeFecha
                    const isWeekend = f.dia_semana === 'Sáb' || f.dia_semana === 'Dom'
                    return (
                      <button
                        key={f.fecha}
                        onClick={() => setCurvaFecha(f.fecha)}
                        className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl text-center transition-all border ${
                          isActive
                            ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                            : hasUnder
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : isWeekend
                                ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-[9px] font-medium leading-none mb-0.5 opacity-70">{f.dia_semana}</span>
                        <span className="text-xs font-black leading-none">{f.dia_num}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Gráfico de franja */}
                {activeFecha && <CurvaFranjaChart sim={simData} fecha={activeFecha} presencia={presencia[activeFecha]} />}

                {/* Leyenda rápida */}
                <div className="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2"/></svg>
                    Requeridos
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#10b981" strokeWidth="2.5"/></svg>
                    Asignados
                  </div>
                  <div className="ml-auto text-xs text-gray-400">
                    {simData.filter(r => r.fecha === activeFecha && r.estado === 'UNDER').length > 0 && (
                      <span className="text-red-500 font-semibold">
                        {simData.filter(r => r.fecha === activeFecha && r.estado === 'UNDER').length} franjas UNDER
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )
        })()}

        {/* ── MOVIMIENTOS ── */}
        {tab === 'movimientos' && (
          <div className="space-y-4">
            {!sim && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                <Minus size={32} className="text-gray-200" />
                <p className="text-sm font-medium">Ejecutá la simulación primero</p>
              </div>
            )}
            {sim && sim.movimientos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center">
                  <CheckCircle size={28} className="text-emerald-400" />
                </div>
                <p className="text-base font-semibold text-gray-600">Sin movimientos propuestos</p>
                <p className="text-sm text-gray-400 text-center max-w-sm">
                  La cobertura actual no requiere ajustes de turno, o los movimientos propuestos empeoraban el resultado.
                </p>
              </div>
            )}
            {sim && sim.movimientos.length > 0 && (
              <>
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-sm text-amber-800">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Se proponen <strong>{sim.movimientos.length}</strong> cambios de turno para reducir las franjas UNDER.
                    Son cambios <strong>permanentes</strong> de ingreso para todo el período, validados para no empeorar la cobertura.
                  </span>
                </div>

                <div className="space-y-2">
                  {sim.movimientos.map((m, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 hover:shadow-md transition-shadow">
                      <span className="text-xs font-black text-gray-300 w-6 text-center tabular-nums">{i + 1}</span>
                      <div className="flex-1 text-sm font-semibold text-gray-800 truncate">{m.nombre}</div>
                      <div className="flex items-center gap-3 shrink-0">
                        <code className="text-sm font-black px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl">{m.de}</code>
                        <ArrowRight size={16} className="text-gray-300" />
                        <code className="text-sm font-black px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl">{m.hacia}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CUPOS FERIADO ── */}
        {tab === 'feriados' && (
          <div className="space-y-5">
            {!sim && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                <Sun size={32} className="text-gray-200" />
                <p className="text-sm font-medium">Ejecutá la simulación primero</p>
              </div>
            )}
            {sim && sim.cupos_feriado.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 bg-sky-50 rounded-3xl flex items-center justify-center">
                  <Sun size={28} className="text-sky-300" />
                </div>
                <p className="text-base font-semibold text-gray-500">Sin cupos de feriado</p>
                <p className="text-sm text-gray-400 text-center max-w-sm">
                  Los cupos aparecen cuando hay agentes disponibles en horarios clave con excedente ≥ 2 vs. el límite inferior.
                </p>
              </div>
            )}
            {sim && sim.cupos_feriado.length > 0 && (
              <>
                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs text-sky-800">
                  Los cupos muestran cuántos agentes pueden tomar feriado en cada horario clave sin bajar del mínimo requerido. Solo se muestran segmentos con excedente ≥ 2.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sim.cupos_feriado.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                      <div className="text-center bg-sky-50 rounded-xl px-3 py-2 shrink-0">
                        <p className="text-lg font-black text-sky-700">{c.cupo}</p>
                        <p className="text-[9px] text-sky-400 font-semibold uppercase tracking-wide">cupos</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{c.isla}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Franja <code className="font-mono font-bold text-gray-600">{c.intervalo}</code>
                          · {c.asignados} asignados
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CalendarDays size={14} className="text-gray-400" /> Franjas consideradas para feriados
              </p>
              <div className="flex flex-wrap gap-2">
                {['06:00','08:00','09:00','14:00','15:00','17:00','18:00','19:00'].map(h => (
                  <span key={h} className="px-3 py-1 bg-gray-100 rounded-xl font-mono text-xs font-bold text-gray-700">{h}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheet selection modal */}
      {sheetModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <h3 className="text-base font-bold text-gray-900 mb-1">Seleccionar hojas</h3>
            <p className="text-xs text-gray-400 mb-5">El archivo tiene múltiples segmentos. Elegí cuáles importar (se sumarán).</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sheetModal.sheets.map(sheet => {
                const checked = sheetModal.selected.includes(sheet)
                return (
                  <label key={sheet} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      className="accent-gray-900"
                      checked={checked}
                      onChange={() => setSheetModal(m => m ? {
                        ...m,
                        selected: checked ? m.selected.filter(s => s !== sheet) : [...m.selected, sheet],
                      } : null)}
                    />
                    <span className="text-sm font-medium text-gray-800">{sheet}</span>
                  </label>
                )
              })}
            </div>
            {uploadReqsMut.isError && (
              <p className="text-xs text-red-600 mt-3 bg-red-50 rounded-xl px-3 py-2">
                {(uploadReqsMut.error as any)?.response?.data?.error ?? 'Error al importar'}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setSheetModal(null)} disabled={uploadReqsMut.isPending}>
                Cancelar
              </button>
              <button
                className="btn-primary flex-1"
                disabled={sheetModal.selected.length === 0 || uploadReqsMut.isPending}
                onClick={() => uploadReqsMut.mutate({ file: sheetModal.file, sheets: sheetModal.selected })}
              >
                {uploadReqsMut.isPending ? 'Importando…' : `Importar (${sheetModal.selected.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
