import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, User, FileText, ArrowLeftRight, History, GitCommitVertical } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { agentesApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { EstadoAgenteBadge, LicenciaBadge, CambioTemporalBadge, NominaEstadoBadge } from '../components/ui/Badge'
import { MESES } from '../types'
import type { TimelineEvento } from '../types'

const TIMELINE_CFG: Record<TimelineEvento['tipo'], { label: string; icon: string; bg: string; badge: string }> = {
  LICENCIA:        { label: 'Licencia',        icon: '🏥', bg: 'bg-red-50',     badge: 'bg-red-100 text-red-600' },
  CAMBIO_TEMPORAL: { label: 'Cambio temporal', icon: '↔️', bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-600' },
  CAMBIO_CONTRATO: { label: 'Cambio contrato', icon: '📋', bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-600' },
  CAPACITACION:    { label: 'Capacitación',    icon: '🎓', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-600' },
  REMOCION:        { label: 'Remoción',        icon: '🚪', bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-600' },
  VACACION:        { label: 'Vacaciones',      icon: '🌴', bg: 'bg-sky-50',     badge: 'bg-sky-100 text-sky-600' },
}

export default function AgenteDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: agente, isLoading } = useQuery({
    queryKey: ['agente', id],
    queryFn: () => agentesApi.get(parseInt(id!)).then((r) => r.data),
    enabled: !!id,
  })

  const { data: timeline = [] } = useQuery<TimelineEvento[]>({
    queryKey: ['agente-timeline', id],
    queryFn: () => agentesApi.timeline(parseInt(id!)).then((r) => r.data),
    enabled: !!id,
  })

  if (isLoading) return <PageLoading />
  if (!agente) return <div className="p-6 text-gray-500">Agente no encontrado</div>

  const now = new Date()
  const licenciaActiva = agente.licencias?.find(
    (l) => now >= new Date(l.fecha_desde) && now <= new Date(l.fecha_hasta)
  )
  const cambioActivo = agente.cambios_temporales?.find(
    (c) => now >= new Date(c.fecha_desde) && now <= new Date(c.fecha_hasta)
  )

  const fields = [
    { label: 'DNI', value: agente.dni },
    { label: 'Usuario', value: agente.usuario },
    { label: 'Nombre', value: agente.nombre },
    { label: 'Superior', value: agente.superior },
    { label: 'Segmento', value: agente.segmento },
    { label: 'Horarios', value: agente.horarios, mono: true },
    { label: 'Estado', value: agente.estado, badge: true },
    { label: 'Contrato', value: agente.contrato },
    { label: 'Sitio', value: agente.sitio },
    { label: 'Modalidad', value: agente.modalidad },
    { label: 'Jefe', value: agente.jefe },
    { label: 'Servicio', value: agente.servicio?.nombre },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title={agente.nombre}
        subtitle={`${agente.usuario} · DNI ${agente.dni}`}
        actions={
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Volver
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Datos del agente */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-konecta flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{agente.nombre}</h2>
                <p className="text-xs text-gray-500">{agente.servicio?.nombre || 'Sin servicio asignado'}</p>
              </div>
              <div className="ml-auto">
                <EstadoAgenteBadge estado={agente.estado} />
                {!agente.activo && <span className="ml-2 text-xs text-red-600 font-semibold">INACTIVO</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {fields.map(({ label, value, mono, badge }) => (
                <div key={label}>
                  <p className="label-base">{label}</p>
                  {badge ? (
                    <EstadoAgenteBadge estado={value as string} />
                  ) : (
                    <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''} ${!value ? 'text-gray-400' : ''}`}>
                      {value || '—'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {agente.observaciones && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="label-base">Observaciones</p>
                <p className="text-sm text-gray-700">{agente.observaciones}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span>Creado: {format(new Date(agente.fecha_creacion), 'dd/MM/yyyy', { locale: es })}</span>
              <span>Actualizado: {format(new Date(agente.fecha_actualizacion), 'dd/MM/yyyy', { locale: es })}</span>
              {!agente.presente_ultima_carga && (
                <span className="text-red-500 font-medium">No presente en última carga</span>
              )}
            </div>
          </div>

          {/* Estado actual */}
          <div className="space-y-4">
            {licenciaActiva && (
              <div className="card p-4 border-yellow-200 bg-yellow-50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-yellow-600" />
                  <p className="text-sm font-bold text-yellow-800">Licencia vigente</p>
                </div>
                <p className="text-xs text-yellow-700">
                  {format(new Date(licenciaActiva.fecha_desde), 'dd/MM/yyyy')} →{' '}
                  {format(new Date(licenciaActiva.fecha_hasta), 'dd/MM/yyyy')}
                </p>
                {licenciaActiva.motivo && <p className="text-xs text-yellow-600 mt-1">{licenciaActiva.motivo}</p>}
              </div>
            )}

            {cambioActivo && (
              <div className="card p-4 border-blue-200 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowLeftRight size={14} className="text-blue-600" />
                  <p className="text-sm font-bold text-blue-800">Cambio temporal activo</p>
                </div>
                <p className="text-xs text-blue-700">→ {cambioActivo.servicio_temporal?.nombre}</p>
                <p className="text-xs text-blue-600">
                  {format(new Date(cambioActivo.fecha_desde), 'dd/MM/yyyy')} →{' '}
                  {format(new Date(cambioActivo.fecha_hasta), 'dd/MM/yyyy')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Historial de licencias */}
        {agente.licencias && agente.licencias.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-konecta" />
              <h3 className="text-sm font-bold text-gray-800">Historial de licencias</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="table-th">Desde</th><th className="table-th">Hasta</th>
                  <th className="table-th">Motivo</th><th className="table-th">Estado</th>
                </tr></thead>
                <tbody>
                  {agente.licencias.map((l) => {
                    const estado = now < new Date(l.fecha_desde) ? 'PROGRAMADA' : now > new Date(l.fecha_hasta) ? 'FINALIZADA' : 'VIGENTE'
                    return (
                      <tr key={l.id} className="table-tr">
                        <td className="table-td">{format(new Date(l.fecha_desde), 'dd/MM/yyyy')}</td>
                        <td className="table-td">{format(new Date(l.fecha_hasta), 'dd/MM/yyyy')}</td>
                        <td className="table-td">{l.motivo || '—'}</td>
                        <td className="table-td"><LicenciaBadge tipo={estado} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Timeline consolidado */}
        {timeline.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <GitCommitVertical size={16} className="text-konecta" />
              <h3 className="text-sm font-bold text-gray-800">Historial de eventos</h3>
              <span className="ml-auto text-xs text-gray-400">{timeline.length} eventos</span>
            </div>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-1">
                {timeline.map((ev, i) => {
                  const cfg = TIMELINE_CFG[ev.tipo]
                  return (
                    <div key={i} className="flex gap-4 group">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 text-sm border-2 border-white ${cfg.bg}`}>
                        {cfg.icon}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                              <p className="text-sm font-semibold text-gray-800 truncate">{ev.descripcion}</p>
                            </div>
                            {ev.detalle && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.detalle}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-gray-600">
                              {format(new Date(ev.fecha_inicio + 'T12:00:00'), 'dd/MM/yyyy')}
                            </p>
                            {ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                → {format(new Date(ev.fecha_fin + 'T12:00:00'), 'dd/MM/yyyy')}
                              </p>
                            )}
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

        {/* Historial de nóminas */}
        {agente.snapshots && agente.snapshots.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={16} className="text-konecta" />
              <h3 className="text-sm font-bold text-gray-800">Historial mensual</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="table-th">Período</th><th className="table-th">Servicio</th>
                  <th className="table-th">Estado</th><th className="table-th">Horario</th>
                  <th className="table-th">Modalidad</th><th className="table-th">Nómina</th>
                </tr></thead>
                <tbody>
                  {agente.snapshots.map((s) => (
                    <tr key={s.id} className="table-tr">
                      <td className="table-td font-medium">{MESES[(s.nomina_mensual?.mes ?? 1) - 1]} {s.nomina_mensual?.anio}</td>
                      <td className="table-td">{s.nomina_mensual?.servicio?.nombre || '—'}</td>
                      <td className="table-td"><EstadoAgenteBadge estado={s.estado} /></td>
                      <td className="table-td font-mono text-xs">{s.horarios || '—'}</td>
                      <td className="table-td">{s.modalidad || '—'}</td>
                      <td className="table-td">
                        {s.nomina_mensual && <NominaEstadoBadge estado={s.nomina_mensual.estado} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
