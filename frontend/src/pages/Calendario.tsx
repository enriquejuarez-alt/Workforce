import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, isSameMonth,
  format, addMonths, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, X, Download, Filter } from 'lucide-react'
import { licenciasApi, serviciosApi } from '../lib/api'
import type { CalendarioEvento, Servicio } from '../types'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'

const DAYS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const BARS_MAX = 3

function initials(nombre: string) {
  const parts = nombre.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Calendario() {
  const navigate = useNavigate()
  const [base, setBase] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [servicioId, setServicioId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const mes = base.getMonth() + 1
  const anio = base.getFullYear()
  const isCurrentMonth = isSameMonth(base, new Date())

  const { data: servicios = [] } = useQuery<Servicio[]>({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
    staleTime: 300_000,
  })

  const { data: eventos = [], isLoading } = useQuery<CalendarioEvento[]>({
    queryKey: ['calendario', mes, anio, servicioId],
    queryFn: () => licenciasApi.calendario(mes, anio, servicioId).then((r) => r.data),
    staleTime: 60_000,
  })

  const eventosByDay = useMemo(() => {
    const map = new Map<string, CalendarioEvento[]>()
    for (const e of eventos) {
      const list = map.get(e.fecha) ?? []
      list.push(e)
      map.set(e.fecha, list)
    }
    return map
  }, [eventos])

  const days = useMemo(() => {
    const first = startOfMonth(base)
    const last = endOfMonth(base)
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 1 }),
      end: endOfWeek(last, { weekStartsOn: 1 }),
    })
  }, [base])

  const selectedEvents = selectedDay
    ? (eventosByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [])
    : []

  const vencimientosTotal = eventos.filter((e) => e.tipo === 'VENCIMIENTO').length
  const iniciosTotal = eventos.filter((e) => e.tipo === 'INICIO').length

  const timeline = useMemo(() =>
    [...eventosByDay.entries()]
      .flatMap(([fecha, evs]) => evs.map((e) => ({ ...e, fechaKey: fecha })))
      .sort((a, b) => {
        const d = a.fechaKey.localeCompare(b.fechaKey)
        return d !== 0 ? d : (a.tipo === 'VENCIMIENTO' ? -1 : 1)
      }),
    [eventosByDay],
  )

  const goToDay = (fechaKey: string) => {
    const d = new Date(fechaKey + 'T12:00:00')
    setSelectedDay(d)
    setBase(d)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await licenciasApi.exportCalendario(mes, anio, servicioId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
      a.href = url
      a.download = `Licencias_${MESES_ES[mes - 1]}_${anio}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const selVenc = selectedEvents.filter((e) => e.tipo === 'VENCIMIENTO')
  const selInic = selectedEvents.filter((e) => e.tipo === 'INICIO')

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Calendario de Licencias"
        subtitle={`${vencimientosTotal} vencimiento${vencimientosTotal !== 1 ? 's' : ''} · ${iniciosTotal} inicio${iniciosTotal !== 1 ? 's' : ''} este mes`}
        actions={
          <div className="flex items-center gap-2">
            {/* Service filter */}
            <div className="relative flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Filter size={12} className="text-gray-400 shrink-0" />
              <select
                value={servicioId ?? ''}
                onChange={(e) => { setServicioId(e.target.value ? parseInt(e.target.value) : null); setSelectedDay(null) }}
                className="text-xs font-medium text-gray-700 bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="">Todos los servicios</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={exporting || eventos.length === 0}
              className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download size={13} />
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex gap-5 p-6">

        {/* ── Calendar ── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden min-w-0">

          {/* Month nav */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 shrink-0">
            <button
              onClick={() => { setBase((b) => subMonths(b, 1)); setSelectedDay(null) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="flex-1 text-center">
              <h2 className="text-sm font-bold text-gray-900 capitalize tracking-tight">
                {format(base, 'MMMM', { locale: es })}
                <span className="text-gray-400 font-medium ml-1.5">{format(base, 'yyyy')}</span>
              </h2>
            </div>

            <button
              onClick={() => { setBase((b) => addMonths(b, 1)); setSelectedDay(null) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <ChevronRight size={15} />
            </button>

            {!isCurrentMonth && (
              <button
                onClick={() => { setBase(new Date()); setSelectedDay(null) }}
                className="ml-1 text-xs font-bold text-konecta border border-konecta/25 px-2.5 py-1 rounded-lg hover:bg-konecta/5 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          {isLoading ? (
            <PageLoading text="Cargando..." />
          ) : (
            <div className="flex-1 overflow-auto p-4">

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_HEADER.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-[10px] font-bold uppercase tracking-wider py-2 ${i >= 5 ? 'text-gray-300' : 'text-gray-400'}`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayEvents = eventosByDay.get(key) ?? []
                  const inMonth = isSameMonth(day, base)
                  const today = isToday(day)
                  const selected = selectedDay ? isSameDay(day, selectedDay) : false
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const hasEvents = dayEvents.length > 0
                  const overflow = dayEvents.length - BARS_MAX

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                      className={[
                        'relative flex flex-col rounded-xl p-2 min-h-[84px] transition-all duration-150 text-left',
                        !inMonth ? 'opacity-20 pointer-events-none' : '',
                        selected
                          ? 'bg-konecta/8 ring-2 ring-konecta/25'
                          : isWeekend
                            ? 'bg-gray-50/50 hover:bg-gray-100/60'
                            : 'hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <span className={[
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mb-1 shrink-0 transition-colors',
                        today
                          ? 'bg-konecta text-white shadow-sm shadow-konecta/30'
                          : selected
                            ? 'text-konecta'
                            : isWeekend
                              ? 'text-gray-400'
                              : 'text-gray-700',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </span>

                      {hasEvents && (
                        <div className="flex flex-col gap-0.5 w-full min-w-0">
                          {dayEvents.slice(0, BARS_MAX).map((e, i) => (
                            <span
                              key={i}
                              className={[
                                'text-[9px] font-semibold px-1.5 py-[2px] rounded-md truncate leading-tight',
                                e.tipo === 'VENCIMIENTO'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700',
                              ].join(' ')}
                            >
                              {e.agente_nombre.split(' ')[0]}
                            </span>
                          ))}
                          {overflow > 0 && (
                            <span className="text-[9px] text-gray-400 font-semibold pl-1.5">
                              +{overflow} más
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer legend */}
          <div className="flex items-center gap-5 px-5 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-red-300 inline-block" />
              <span className="text-[11px] text-gray-500">Vencimiento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-emerald-300 inline-block" />
              <span className="text-[11px] text-gray-500">Inicio</span>
            </div>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={11} />
                Limpiar selección
              </button>
            )}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="w-72 shrink-0 flex flex-col gap-3">

          {selectedDay ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
              <div className={[
                'px-5 py-4 shrink-0',
                selectedEvents.length === 0
                  ? 'bg-gray-50'
                  : selVenc.length > 0 && selInic.length > 0
                    ? 'bg-gradient-to-r from-red-50 to-emerald-50'
                    : selVenc.length > 0
                      ? 'bg-red-50'
                      : 'bg-emerald-50',
              ].join(' ')}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 text-sm capitalize">
                      {format(selectedDay, "EEEE d", { locale: es })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {format(selectedDay, "MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {selVenc.length > 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        {selVenc.length}↓
                      </span>
                    )}
                    {selInic.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {selInic.length}↑
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
                    <CalendarDays size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Sin licencias este día</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {(['VENCIMIENTO', 'INICIO'] as const).map((tipo) => {
                    const group = selectedEvents.filter((e) => e.tipo === tipo)
                    if (!group.length) return null
                    const isVenc = tipo === 'VENCIMIENTO'
                    return (
                      <div key={tipo}>
                        <div className={`flex items-center gap-2 px-5 py-2 border-b border-gray-50 ${isVenc ? 'bg-red-50/50' : 'bg-emerald-50/50'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isVenc ? 'bg-red-400' : 'bg-emerald-400'}`} />
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${isVenc ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isVenc ? 'Vencimientos' : 'Inicios'}
                          </p>
                        </div>
                        {group.map((e, i) => (
                          <button
                            key={i}
                            onClick={() => navigate(`/nomina/agente/${e.agente_id}`)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${isVenc ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {initials(e.agente_nombre)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-konecta transition-colors">
                                {e.agente_nombre}
                              </p>
                              {(e.servicio_nombre || e.motivo) && (
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                  {[e.servicio_nombre, e.motivo].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            <ExternalLink size={11} className="text-gray-300 group-hover:text-konecta transition-colors shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">Vencimientos</p>
                  <p className="text-2xl font-black text-red-600 leading-none">{vencimientosTotal}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Inicios</p>
                  <p className="text-2xl font-black text-emerald-600 leading-none">{iniciosTotal}</p>
                </div>
              </div>

              {timeline.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-5 py-3 border-b border-gray-100">
                    Eventos del mes
                  </p>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {timeline.map((e, i) => {
                      const isVenc = e.tipo === 'VENCIMIENTO'
                      const d = new Date(e.fechaKey + 'T12:00:00')
                      return (
                        <button
                          key={i}
                          onClick={() => goToDay(e.fechaKey)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors group"
                        >
                          <div className="text-center shrink-0 w-8">
                            <p className={`text-sm font-black leading-none ${isVenc ? 'text-red-500' : 'text-emerald-500'}`}>
                              {format(d, 'd')}
                            </p>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase mt-0.5">
                              {format(d, 'MMM', { locale: es })}
                            </p>
                          </div>
                          <div className={`w-px h-7 rounded-full shrink-0 ${isVenc ? 'bg-red-200' : 'bg-emerald-200'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-konecta transition-colors">
                              {e.agente_nombre}
                            </p>
                            <p className={`text-[10px] font-medium truncate ${isVenc ? 'text-red-400' : 'text-emerald-500'}`}>
                              {isVenc ? 'Vencimiento' : 'Inicio'}
                              {e.servicio_nombre ? ` · ${e.servicio_nombre}` : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : !isLoading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-3 text-center">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
                    <CalendarDays size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Sin eventos este mes</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
