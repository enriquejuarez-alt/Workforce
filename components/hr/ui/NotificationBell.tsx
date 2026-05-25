"use client"

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, X, AlertCircle, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { notificacionesApi } from '@/lib/api'

type Notif = {
  id: string
  tipo: 'LICENCIA_HOY' | 'LICENCIA_PROXIMA' | 'LICENCIA_VENCIDA'
  urgencia: 'alta' | 'media' | 'baja'
  titulo: string
  descripcion: string
  servicio: string | null
  agente_id: number
  agente_nombre: string
  fecha: string
}

const STORAGE_KEY = 'notif_leidas_v1'

function getLeidas(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveLeidas(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

const TIPO_CONFIG = {
  LICENCIA_HOY: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-500',
  },
  LICENCIA_PROXIMA: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    dot: 'bg-amber-400',
  },
  LICENCIA_VENCIDA: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-400',
  },
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [leidas, setLeidas] = useState<Set<string>>(getLeidas)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const { data: notifs = [] } = useQuery<Notif[]>({
    queryKey: ['notificaciones'],
    queryFn: () => notificacionesApi.get().then((r) => r.data),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })

  const unread = notifs.filter((n) => !leidas.has(n.id)).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMarkAll = () => {
    const newLeidas = new Set([...leidas, ...notifs.map((n) => n.id)])
    setLeidas(newLeidas)
    saveLeidas(newLeidas)
  }

  const handleMarkOne = (id: string) => {
    const newLeidas = new Set(leidas).add(id)
    setLeidas(newLeidas)
    saveLeidas(newLeidas)
  }

  const handleClickNotif = (n: Notif) => {
    handleMarkOne(n.id)
    setOpen(false)
    router.push(`/nomina/agente/${n.agente_id}`)
  }

  const alta = notifs.filter((n) => n.urgencia === 'alta')
  const media = notifs.filter((n) => n.urgencia === 'media')
  const baja = notifs.filter((n) => n.urgencia === 'baja')

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        title="Notificaciones"
      >
        <Bell
          size={18}
          style={unread > 0 ? { animation: 'bellRing 2.5s ease-in-out infinite' } : undefined}
        />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 w-[360px] max-h-[480px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ animation: 'dropIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-gray-600" />
              <span className="font-bold text-sm text-gray-800">Notificaciones</span>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unread} nueva{unread !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[11px] text-konecta font-semibold hover:underline px-1"
                >
                  Marcar como leídas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <Bell size={22} className="text-green-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Todo al día</p>
                <p className="text-xs text-gray-400">No hay licencias próximas a vencer.</p>
              </div>
            ) : (
              <div>
                {[
                  { label: 'Urgente', items: alta },
                  { label: 'Próximas', items: media },
                  { label: 'Recientes', items: baja },
                ].map(({ label, items }) =>
                  items.length > 0 ? (
                    <div key={label}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50/70 border-b border-gray-100">
                        {label}
                      </p>
                      {items.map((n) => {
                        const cfg = TIPO_CONFIG[n.tipo]
                        const Icon = cfg.icon
                        const isUnread = !leidas.has(n.id)
                        return (
                          <button
                            key={n.id}
                            onClick={() => handleClickNotif(n)}
                            className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${isUnread ? 'bg-blue-50/30' : ''}`}
                          >
                            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                              <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center`}>
                                <Icon size={14} className={cfg.color} />
                              </div>
                              {isUnread && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold leading-tight ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                                {n.titulo}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{n.descripcion}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {n.servicio && (
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                    {n.servicio}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {format(parseISO(String(n.fecha).substring(0, 10)), "dd/MM/yyyy", { locale: es })}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={13} className="text-gray-300 shrink-0 mt-1" />
                          </button>
                        )
                      })}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bellRing {
          0%,50%,100% { transform: rotate(0deg); }
          5%  { transform: rotate(14deg); }
          10% { transform: rotate(-12deg); }
          15% { transform: rotate(10deg); }
          20% { transform: rotate(-8deg); }
          25% { transform: rotate(5deg); }
          30% { transform: rotate(0deg); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
