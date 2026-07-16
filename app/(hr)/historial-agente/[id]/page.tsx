"use client";

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, User, Briefcase, GraduationCap, DoorOpen, GitCommitVertical,
  ShieldCheck, Layers, Repeat,
} from 'lucide-react'
import Header from '@/components/hr/layout/Header'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import { EstadoAgenteBadge } from '@/components/hr/ui/Badge'
import AgentTimeline, { TIMELINE_CFG } from '@/components/hr/ui/AgentTimeline'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { agentesApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { TimelineEvento } from '@/types'

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return format(new Date(d.substring(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })
}

function calcularAntiguedad(desde: string): string {
  const inicio = new Date(desde)
  const hoy = new Date()
  let meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  if (hoy.getDate() < inicio.getDate()) meses--
  if (meses < 0) meses = 0
  const anios = Math.floor(meses / 12)
  const mesesRestantes = meses % 12
  if (anios === 0) return `${mesesRestantes} mes${mesesRestantes !== 1 ? 'es' : ''}`
  return `${anios} año${anios !== 1 ? 's' : ''}${mesesRestantes ? ` ${mesesRestantes}m` : ''}`
}

const RESULTADO_BADGE: Record<string, string> = {
  INSCRIPTO: 'bg-gray-100 text-gray-600',
  EN_CURSO: 'bg-blue-100 text-blue-700',
  APROBADO: 'bg-green-100 text-green-700',
  DESAPROBADO: 'bg-red-100 text-red-700',
  AUSENTE: 'bg-orange-100 text-orange-700',
  CANCELADO: 'bg-gray-100 text-gray-500',
}

type TipoFiltro = TimelineEvento['tipo'] | 'TODOS'

export default function FichaAgente() {
  const params = useParams()
  const id = parseInt(params.id as string)
  const router = useRouter()
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const [filtroTimeline, setFiltroTimeline] = useState<TipoFiltro>('TODOS')

  const { data: agente, isLoading } = useQuery({
    queryKey: ['historial-agente-ficha', id],
    queryFn: () => agentesApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: timeline = [] } = useQuery<TimelineEvento[]>({
    queryKey: ['agente-timeline', id],
    queryFn: () => agentesApi.timeline(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: auditData } = useQuery({
    queryKey: ['agente-audit', id],
    queryFn: () => agentesApi.audit(id).then((r) => r.data),
    enabled: !!id && isAdmin,
  })

  const servicioVigente = useMemo(
    () => agente?.servicio_historial?.find((s) => s.fecha_hasta === null),
    [agente]
  )

  const eventosFiltrados = filtroTimeline === 'TODOS' ? timeline : timeline.filter((e) => e.tipo === filtroTimeline)

  if (isLoading) return <PageLoading />
  if (!agente) return <div className="p-6 text-gray-500">Agente no encontrado</div>

  const resumenFields = [
    { label: 'DNI', value: agente.dni },
    { label: 'Usuario', value: agente.usuario },
    { label: 'Fecha de nacimiento', value: fmt(agente.fecha_nacimiento) },
    { label: 'Edad', value: agente.edad != null ? `${agente.edad} años` : '—' },
    { label: 'Fecha de ingreso', value: fmt(agente.fecha_creacion) },
    { label: 'Antigüedad', value: calcularAntiguedad(agente.fecha_creacion) },
    { label: 'Servicio actual', value: agente.servicio?.nombre },
    { label: 'Modalidad', value: agente.modalidad },
    { label: 'Superior', value: agente.superior },
    { label: 'Jefe', value: agente.jefe },
    { label: 'Segmento', value: agente.segmento },
    { label: 'Sitio', value: agente.sitio },
    { label: 'Contrato', value: agente.contrato },
    { label: 'Horarios', value: agente.horarios, mono: true },
    { label: 'Última actualización', value: fmt(agente.fecha_actualizacion) },
  ]

  const indicadores = [
    { label: 'Servicios', value: agente.servicio_historial?.length ?? 0, Icon: Briefcase },
    { label: 'Capacitaciones', value: agente.capacitaciones?.length ?? 0, Icon: GraduationCap },
    { label: 'Remociones', value: agente.remociones?.length ?? 0, Icon: DoorOpen },
    { label: 'Cambios modalidad', value: agente.modalidad_historial?.length ?? 0, Icon: Repeat },
    {
      label: 'En servicio actual',
      value: servicioVigente ? calcularAntiguedad(servicioVigente.fecha_desde) : '—',
      Icon: Layers,
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title={agente.nombre}
        subtitle={`${agente.usuario} · DNI ${agente.dni}`}
        actions={
          <button className="btn-secondary" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Volver
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {indicadores.map(({ label, value, Icon }) => (
            <div key={label} className="card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-konecta" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-800 leading-none">{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="resumen">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="capacitaciones">Capacitaciones</TabsTrigger>
            <TabsTrigger value="remociones">Remociones</TabsTrigger>
            <TabsTrigger value="timeline">Línea de tiempo</TabsTrigger>
            {isAdmin && <TabsTrigger value="auditoria">Auditoría</TabsTrigger>}
          </TabsList>

          <TabsContent value="resumen">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-konecta flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{agente.nombre}</h2>
                  <p className="text-xs text-gray-500">{agente.servicio?.nombre || 'Sin servicio asignado'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <EstadoAgenteBadge estado={agente.estado} />
                  {!agente.activo && <span className="text-xs text-red-600 font-semibold">INACTIVO</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {resumenFields.map(({ label, value, mono }) => (
                  <div key={label}>
                    <p className="label-base">{label}</p>
                    <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''} ${!value || value === '—' ? 'text-gray-400' : ''}`}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>
              {agente.observaciones && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="label-base">Observaciones</p>
                  <p className="text-sm text-gray-700">{agente.observaciones}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="servicios">
            {!agente.servicio_historial || agente.servicio_historial.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Sin historial de servicios registrado.</p>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-th">Servicio</th>
                      <th className="table-th">Desde</th>
                      <th className="table-th">Hasta</th>
                      <th className="table-th">Modalidad</th>
                      <th className="table-th">Superior</th>
                      <th className="table-th">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agente.servicio_historial.map((h) => (
                      <tr key={h.id} className="table-tr">
                        <td className="table-td font-semibold">
                          {h.servicio?.nombre || '—'}
                          {h.fecha_hasta === null && (
                            <span className="ml-2 text-[10px] font-bold uppercase text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Vigente</span>
                          )}
                        </td>
                        <td className="table-td text-xs">{fmt(h.fecha_desde)}</td>
                        <td className="table-td text-xs">{h.fecha_hasta ? fmt(h.fecha_hasta) : '—'}</td>
                        <td className="table-td text-xs">{h.modalidad || '—'}</td>
                        <td className="table-td text-xs">{h.superior || '—'}</td>
                        <td className="table-td text-xs">{h.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="capacitaciones">
            {!agente.capacitaciones || agente.capacitaciones.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Sin capacitaciones registradas.</p>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-th">Tipo</th>
                      <th className="table-th">Servicio</th>
                      <th className="table-th">Desde</th>
                      <th className="table-th">Hasta</th>
                      <th className="table-th">Resultado</th>
                      <th className="table-th">Capacitador</th>
                      <th className="table-th">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agente.capacitaciones.map((c) => (
                      <tr key={c.id} className="table-tr">
                        <td className="table-td font-semibold text-xs">{c.tipo_formacion || '—'}</td>
                        <td className="table-td text-xs">{c.servicio_nombre || '—'}</td>
                        <td className="table-td text-xs">{fmt(c.fecha_inicio)}</td>
                        <td className="table-td text-xs">{fmt(c.fecha_fin)}</td>
                        <td className="table-td">
                          {c.resultado ? (
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${RESULTADO_BADGE[c.resultado] || 'bg-gray-100 text-gray-500'}`}>
                              {c.resultado}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="table-td text-xs">{c.capacitador?.nombre || '—'}</td>
                        <td className="table-td text-xs text-gray-500">{c.observacion || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="remociones">
            {!agente.remociones || agente.remociones.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Sin remociones registradas.</p>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-th">Fecha</th>
                      <th className="table-th">Servicio</th>
                      <th className="table-th">Tipo</th>
                      <th className="table-th">Motivo</th>
                      <th className="table-th">Estado</th>
                      <th className="table-th">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agente.remociones.map((r) => (
                      <tr key={r.id} className="table-tr">
                        <td className="table-td text-xs">{fmt(r.fecha)}</td>
                        <td className="table-td text-xs">{r.servicio_nombre || '—'}</td>
                        <td className="table-td text-xs">{r.tipo || '—'}</td>
                        <td className="table-td text-xs">{r.motivo || '—'}</td>
                        <td className="table-td text-xs">{r.estado_remocion || '—'}</td>
                        <td className="table-td text-xs text-gray-500">{r.observacion || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['TODOS', ...Object.keys(TIMELINE_CFG)] as TipoFiltro[]).map((tipo) => {
                  const count = tipo === 'TODOS' ? timeline.length : timeline.filter((e) => e.tipo === tipo).length
                  if (tipo !== 'TODOS' && count === 0) return null
                  const active = filtroTimeline === tipo
                  return (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTimeline(tipo)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {tipo === 'TODOS' ? 'Todos' : TIMELINE_CFG[tipo as TimelineEvento['tipo']].label}
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${active ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
              {eventosFiltrados.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">Sin eventos para el filtro seleccionado.</p>
              ) : (
                <AgentTimeline eventos={eventosFiltrados} />
              )}
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="auditoria">
              {!auditData || auditData.data.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">Sin registros de auditoría.</p>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="table-th">Fecha</th>
                        <th className="table-th">Acción</th>
                        <th className="table-th">Usuario</th>
                        <th className="table-th">Anterior</th>
                        <th className="table-th">Nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.data.map((a) => (
                        <tr key={a.id} className="table-tr">
                          <td className="table-td text-xs">{format(new Date(a.fecha_hora), 'dd/MM/yyyy HH:mm', { locale: es })}</td>
                          <td className="table-td text-xs font-semibold flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-gray-400" /> {a.accion}
                          </td>
                          <td className="table-td text-xs">{a.usuario?.nombre || '—'}</td>
                          <td className="table-td text-xs text-gray-500">{a.valor_anterior || '—'}</td>
                          <td className="table-td text-xs text-gray-700">{a.valor_nuevo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
