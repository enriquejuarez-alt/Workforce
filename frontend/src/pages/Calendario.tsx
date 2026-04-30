import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, isSameMonth,
  format, addMonths, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, Circle, ExternalLink } from 'lucide-react'
import { licenciasApi } from '../lib/api'
import type { CalendarioEvento } from '../types'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'

const DAYS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TIPO = {
  VENCIMIENTO: { label: 'Vence', color: '#EF4444', bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  INICIO:      { label: 'Inicia', color: '#22C55E', bg: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
}

export default function Calendario() {
  const navigate = useNavigate()
  const [base, setBase] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const mes = base.getMonth() + 1
  const anio = base.getFullYear()

  const { data: eventos = [], isLoading } = useQuery<CalendarioEvento[]>({
    queryKey: ['calendario', mes, anio],
    queryFn: () => licenciasApi.calendario(mes, anio).then((r) => r.data),
    staleTime: 60_000,
  })

  // Group events by date string yyyy-MM-dd
  const eventosByDay = useMemo(() => {
    const map = new Map<string, CalendarioEvento[]>()
    for (const e of eventos) {
      const list = map.get(e.fecha) ?? []
      list.push(e)
      map.set(e.fecha, list)
    }
    return map
  }, [eventos])

  // Build calendar grid (Mon–Sun weeks)
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

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Calendario de Licencias"
        subtitle={`${vencimientosTotal} vencimiento${vencimientosTotal !== 1 ? 's' : ''} · ${iniciosTotal} inicio${iniciosTotal !== 1 ? 's' : ''} este mes`}
      />

      <div className="flex-1 overflow-hidden flex gap-5 p-6">
        {/* ── Calendar ── */}
        <div className="flex-1 card flex flex-col overflow-hidden min-w-0">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <button
              onClick={() => { setBase((b) => subMonths(b, 1)); setSelectedDay(null) }}
              className="btn-ghost py-1.5 px-2"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-bold text-gray-900 capitalize">
              {format(base, "MMMM yyyy", { locale: es })}
            </h2>
            <button
              onClick={() => { setBase((b) => addMonths(b, 1)); setSelectedDay(null) }}
              className="btn-ghost py-1.5 px-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {isLoading ? (
            <PageLoading text="Cargando..." />
          ) : (
            <div className="flex-1 overflow-auto p-3">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HEADER.map((d) => (
                  <div key={d} className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide py-2">
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
                  const venc = dayEvents.filter((e) => e.tipo === 'VENCIMIENTO')
                  const inic = dayEvents.filter((e) => e.tipo === 'INICIO')
                  const hasEvents = dayEvents.length > 0

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                      className={`
                        relative flex flex-col items-center rounded-xl p-1.5 min-h-[72px] transition-all
                        ${!inMonth ? 'opacity-30' : ''}
                        ${selected ? 'bg-konecta/8 ring-2 ring-konecta/30' : hasEvents ? 'hover:bg-gray-50' : 'hover:bg-gray-50/60'}
                      `}
                    >
                      {/* Day number */}
                      <span className={`
                        w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 transition-colors
                        ${today ? 'bg-konecta text-white' : selected ? 'text-konecta font-bold' : 'text-gray-700'}
                      `}>
                        {format(day, 'd')}
                      </span>

                      {/* Event indicators */}
                      {hasEvents && (
                        <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                          {venc.length > 0 && (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded-full">
                              {venc.length}↓
                            </span>
                          )}
                          {inic.length > 0 && (
                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 rounded-full">
                              {inic.length}↑
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

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-500">Vencimiento de licencia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500">Inicio de licencia</span>
            </div>
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          {selectedDay ? (
            <div className="card flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <p className="font-bold text-gray-900 text-sm capitalize">
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedEvents.length === 0
                    ? 'Sin eventos'
                    : `${selectedEvents.length} evento${selectedEvents.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-6">
                  <CalendarDays size={28} className="text-gray-200" />
                  <p className="text-xs text-gray-400">Sin licencias registradas</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                  {(['VENCIMIENTO', 'INICIO'] as const).map((tipo) => {
                    const group = selectedEvents.filter((e) => e.tipo === tipo)
                    if (!group.length) return null
                    const cfg = TIPO[tipo]
                    return (
                      <div key={tipo}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 ${cfg.light} ${cfg.text}`}>
                          {tipo === 'VENCIMIENTO' ? '🔴 Vencimientos' : '🟢 Inicios'}
                        </p>
                        {group.map((e, i) => (
                          <button
                            key={i}
                            onClick={() => navigate(`/nomina/agente/${e.agente_id}`)}
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors group"
                          >
                            <Circle size={8} className={`${cfg.text} shrink-0 mt-1.5`} fill="currentColor" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-konecta">
                                {e.agente_nombre}
                              </p>
                              {e.servicio_nombre && (
                                <p className="text-[11px] text-gray-400 truncate">{e.servicio_nombre}</p>
                              )}
                              {e.motivo && (
                                <p className="text-[10px] text-gray-300 truncate mt-0.5">{e.motivo}</p>
                              )}
                            </div>
                            <ExternalLink size={12} className="text-gray-300 group-hover:text-konecta shrink-0 mt-1" />
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
              {/* Resumen del mes */}
              <div className="card p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Resumen del mes</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <span className="text-sm text-gray-600">Vencimientos</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{vencimientosTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm text-gray-600">Inicios</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{iniciosTotal}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total eventos</span>
                    <span className="text-sm font-bold text-gray-900">{eventos.length}</span>
                  </div>
                </div>
              </div>

              {/* Vencimientos del mes */}
              {eventos.filter((e) => e.tipo === 'VENCIMIENTO').length > 0 && (
                <div className="card p-4 flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      Vencimientos del mes
                    </span>
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {[...eventosByDay.entries()]
                      .flatMap(([fecha, evs]) =>
                        evs
                          .filter((e) => e.tipo === 'VENCIMIENTO')
                          .map((e) => ({ ...e, fechaKey: fecha }))
                      )
                      .sort((a, b) => a.fechaKey.localeCompare(b.fechaKey))
                      .map((e, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const d = new Date(e.fechaKey + 'T12:00:00')
                            setSelectedDay(d)
                            setBase(d)
                          }}
                          className="w-full flex items-center gap-2.5 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors group"
                        >
                          <span className="text-[11px] font-bold text-red-500 w-12 shrink-0">
                            {format(new Date(e.fechaKey + 'T12:00:00'), 'dd/MM')}
                          </span>
                          <span className="text-xs text-gray-700 truncate group-hover:text-konecta">
                            {e.agente_nombre}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Inicios del mes */}
              {eventos.filter((e) => e.tipo === 'INICIO').length > 0 && (
                <div className="card p-4 flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      Inicios del mes
                    </span>
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {[...eventosByDay.entries()]
                      .flatMap(([fecha, evs]) =>
                        evs
                          .filter((e) => e.tipo === 'INICIO')
                          .map((e) => ({ ...e, fechaKey: fecha }))
                      )
                      .sort((a, b) => a.fechaKey.localeCompare(b.fechaKey))
                      .map((e, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const d = new Date(e.fechaKey + 'T12:00:00')
                            setSelectedDay(d)
                            setBase(d)
                          }}
                          className="w-full flex items-center gap-2.5 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors group"
                        >
                          <span className="text-[11px] font-bold text-green-600 w-12 shrink-0">
                            {format(new Date(e.fechaKey + 'T12:00:00'), 'dd/MM')}
                          </span>
                          <span className="text-xs text-gray-700 truncate group-hover:text-konecta">
                            {e.agente_nombre}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {eventos.length === 0 && !isLoading && (
                <div className="card p-6 flex flex-col items-center gap-2 text-center">
                  <CalendarDays size={28} className="text-gray-200" />
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
