"use client";

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Search, X, Stethoscope, RefreshCw, ScrollText,
  GraduationCap, DoorOpen, Palmtree, UserX, GitCommitVertical,
} from 'lucide-react'
import Header from '@/components/hr/layout/Header'
import { agentesApi } from '@/lib/api'
import type { Agente, TimelineEvento } from '@/types'
import type { LucideIcon } from 'lucide-react'

type TipoFiltro = TimelineEvento['tipo'] | 'TODOS'

const TIPO_CFG: Record<TimelineEvento['tipo'], {
  label: string; Icon: LucideIcon
  iconColor: string; bg: string; badge: string; filtro: string
}> = {
  LICENCIA:        { label: 'Licencia',         Icon: Stethoscope,  iconColor: 'text-red-400',     bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',     filtro: 'bg-red-100 text-red-700 border-red-200' },
  CAMBIO_TEMPORAL: { label: 'Cambio de servicio',Icon: RefreshCw,    iconColor: 'text-blue-400',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',   filtro: 'bg-blue-100 text-blue-700 border-blue-200' },
  CAMBIO_CONTRATO: { label: 'Cambio de contrato',Icon: ScrollText,   iconColor: 'text-purple-400',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700',filtro: 'bg-purple-100 text-purple-700 border-purple-200' },
  CAPACITACION:    { label: 'Capacitación',      Icon: GraduationCap,iconColor: 'text-emerald-500', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700',filtro: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  REMOCION:        { label: 'Remoción',          Icon: DoorOpen,     iconColor: 'text-orange-400',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700', filtro: 'bg-orange-100 text-orange-700 border-orange-200' },
  VACACION:        { label: 'Vacaciones',        Icon: Palmtree,     iconColor: 'text-sky-400',     bg: 'bg-sky-50',     badge: 'bg-sky-100 text-sky-700',     filtro: 'bg-sky-100 text-sky-700 border-sky-200' },
  BAJA:            { label: 'Baja',              Icon: UserX,        iconColor: 'text-gray-500',    bg: 'bg-gray-100',   badge: 'bg-gray-200 text-gray-700',   filtro: 'bg-gray-200 text-gray-700 border-gray-300' },
}

const FILTROS: { tipo: TipoFiltro; label: string }[] = [
  { tipo: 'TODOS', label: 'Todos' },
  { tipo: 'LICENCIA', label: 'Licencias' },
  { tipo: 'VACACION', label: 'Vacaciones' },
  { tipo: 'CAMBIO_CONTRATO', label: 'Cambio contrato' },
  { tipo: 'CAMBIO_TEMPORAL', label: 'Cambio servicio' },
  { tipo: 'CAPACITACION', label: 'Capacitaciones' },
  { tipo: 'REMOCION', label: 'Remociones' },
  { tipo: 'BAJA', label: 'Bajas' },
]

function fmtFecha(iso: string) {
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })
}

export default function HistorialAgente() {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [agente, setAgente] = useState<Agente | null>(null)
  const [filtro, setFiltro] = useState<TipoFiltro>('TODOS')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: resultados = [] } = useQuery({
    queryKey: ['agentes-historial-search', query],
    queryFn: () => agentesApi.list({ search: query }).then((r) => r.data.slice(0, 8)),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })

  const { data: timeline = [], isLoading: loadingTimeline } = useQuery<TimelineEvento[]>({
    queryKey: ['agente-timeline', agente?.id],
    queryFn: () => agentesApi.timeline(agente!.id).then((r) => r.data),
    enabled: !!agente,
  })

  function seleccionar(a: Agente) {
    setAgente(a)
    setQuery(a.nombre)
    setShowResults(false)
    setFiltro('TODOS')
  }

  function limpiar() {
    setAgente(null)
    setQuery('')
    setFiltro('TODOS')
  }

  const eventosFiltrados = filtro === 'TODOS'
    ? timeline
    : timeline.filter((e) => e.tipo === filtro)

  // Agrupar por año para los separadores
  const eventosConAño = eventosFiltrados.map((e, i) => {
    const año = e.fecha_inicio.substring(0, 4)
    const añoAnterior = i > 0 ? eventosFiltrados[i - 1].fecha_inicio.substring(0, 4) : null
    return { ...e, año, esNuevoAño: año !== añoAnterior }
  })

  const conteosPorTipo = (tipo: TimelineEvento['tipo']) =>
    timeline.filter((e) => e.tipo === tipo).length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Historial de Agente"
        subtitle="Línea de tiempo unificada por agente"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Buscador */}
        <div className="card p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Buscar agente
          </label>
          <div ref={searchRef} className="relative max-w-lg">
            {agente ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-blue-900">{agente.nombre}</p>
                  <p className="text-xs text-blue-600">
                    DNI {agente.dni}
                    {agente.servicio ? ` · ${agente.servicio.nombre}` : ''}
                    {agente.contrato ? ` · ${agente.contrato} hs` : ''}
                  </p>
                </div>
                <button
                  onClick={limpiar}
                  className="text-blue-400 hover:text-blue-600 p-1 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
                  onFocus={() => query.length >= 2 && setShowResults(true)}
                  placeholder="Nombre o DNI del agente..."
                  className="input-field pl-9 text-sm w-full"
                  autoFocus
                />
                {showResults && query.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {resultados.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                    ) : (
                      resultados.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => seleccionar(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                          <p className="text-xs text-gray-500">
                            DNI: {a.dni}
                            {a.contrato ? ` · ${a.contrato} hs` : ''}
                            {a.servicio ? ` · ${a.servicio.nombre}` : ''}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Timeline */}
        {agente && (
          <>
            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              {FILTROS.map(({ tipo, label }) => {
                const count = tipo === 'TODOS' ? timeline.length : conteosPorTipo(tipo as TimelineEvento['tipo'])
                if (tipo !== 'TODOS' && count === 0) return null
                const active = filtro === tipo
                return (
                  <button
                    key={tipo}
                    onClick={() => setFiltro(tipo)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? tipo === 'TODOS'
                          ? 'bg-gray-900 text-white border-gray-900'
                          : TIPO_CFG[tipo as TimelineEvento['tipo']].filtro + ' border'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label}
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/30' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Lista de eventos */}
            {loadingTimeline ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                Cargando historial...
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <GitCommitVertical size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Sin eventos para el filtro seleccionado</p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <GitCommitVertical size={16} className="text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700">
                    {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" />

                  <div className="space-y-0">
                    {eventosConAño.map((ev, i) => {
                      const cfg = TIPO_CFG[ev.tipo]
                      return (
                        <div key={i}>
                          {ev.esNuevoAño && (
                            <div className="flex items-center gap-3 mb-3 mt-2 first:mt-0">
                              <div className="w-10 flex justify-center z-10 relative">
                                <span className="text-[10px] font-bold text-gray-400 bg-white px-1">{ev.año}</span>
                              </div>
                              <div className="flex-1 h-px bg-gray-100" />
                            </div>
                          )}

                          <div className="flex gap-4 group pb-4">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white shadow-sm ${cfg.bg}`}>
                              <cfg.Icon size={15} className={cfg.iconColor} />
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                      {cfg.label}
                                    </span>
                                    <p className="text-sm font-medium text-gray-800 leading-snug">
                                      {ev.descripcion}
                                    </p>
                                  </div>
                                  {ev.detalle && (
                                    <p className="text-xs text-gray-400 mt-0.5">{ev.detalle}</p>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-xs font-semibold text-gray-600 tabular-nums">
                                    {fmtFecha(ev.fecha_inicio)}
                                  </p>
                                  {ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio && (
                                    <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                                      → {fmtFecha(ev.fecha_fin)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!agente && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-300">
            <GitCommitVertical size={48} className="mb-3" />
            <p className="text-sm text-gray-400">Buscá un agente para ver su historial</p>
          </div>
        )}
      </div>
    </div>
  )
}
