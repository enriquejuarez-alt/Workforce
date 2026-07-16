import {
  GitCommitVertical, Stethoscope, RefreshCw, ScrollText, Clock,
  GraduationCap, DoorOpen, Palmtree, UserX, Repeat, UserCog, Briefcase,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import type { TimelineEvento } from '@/types'

export const TIMELINE_CFG: Record<TimelineEvento['tipo'], { label: string; Icon: LucideIcon; iconColor: string; bg: string; badge: string }> = {
  LICENCIA:         { label: 'Licencia',        Icon: Stethoscope,   iconColor: 'text-red-400',     bg: 'bg-red-50',     badge: 'bg-red-100 text-red-600' },
  CAMBIO_SERVICIO:  { label: 'Cambio de servicio', Icon: Briefcase,  iconColor: 'text-cyan-500',    bg: 'bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-700' },
  CAMBIO_TEMPORAL:  { label: 'Cambio temporal', Icon: RefreshCw,     iconColor: 'text-blue-400',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-600' },
  CAMBIO_CONTRATO:  { label: 'Cambio contrato', Icon: ScrollText,    iconColor: 'text-purple-400',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-600' },
  CAMBIO_HORARIO:   { label: 'Cambio horario',  Icon: Clock,         iconColor: 'text-indigo-400',  bg: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-600' },
  CAMBIO_MODALIDAD: { label: 'Cambio modalidad', Icon: Repeat,       iconColor: 'text-teal-400',    bg: 'bg-teal-50',    badge: 'bg-teal-100 text-teal-600' },
  CAMBIO_SUPERIOR:  { label: 'Cambio superior', Icon: UserCog,       iconColor: 'text-amber-500',   bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700' },
  CAPACITACION:     { label: 'Capacitación',    Icon: GraduationCap, iconColor: 'text-emerald-400', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-600' },
  REMOCION:         { label: 'Remoción',        Icon: DoorOpen,      iconColor: 'text-orange-400',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-600' },
  VACACION:         { label: 'Vacaciones',      Icon: Palmtree,      iconColor: 'text-sky-400',     bg: 'bg-sky-50',     badge: 'bg-sky-100 text-sky-600' },
  BAJA:             { label: 'Baja',            Icon: UserX,         iconColor: 'text-gray-500',    bg: 'bg-gray-100',   badge: 'bg-gray-200 text-gray-700' },
}

interface AgentTimelineProps {
  eventos: TimelineEvento[]
  title?: string
}

export default function AgentTimeline({ eventos, title = 'Historial de eventos' }: AgentTimelineProps) {
  if (eventos.length === 0) return null

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <GitCommitVertical size={16} className="text-konecta" />
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">{eventos.length} eventos</span>
      </div>
      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" />
        <div className="space-y-1">
          {eventos.map((ev, i) => {
            const cfg = TIMELINE_CFG[ev.tipo]
            return (
              <div key={i} className="flex gap-4 group">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white ${cfg.bg}`}>
                  <cfg.Icon size={15} className={cfg.iconColor} />
                </div>
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
  )
}
