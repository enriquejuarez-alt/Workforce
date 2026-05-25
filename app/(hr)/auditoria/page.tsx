"use client";

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import Header from '@/components/hr/layout/Header'
import { auditoriaApi, usersApi } from '@/lib/api'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import EmptyState from '@/components/hr/ui/EmptyState'

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  CREAR: 'bg-blue-100 text-blue-700',
  EDITAR_AGENTE_NOMINA: 'bg-yellow-100 text-yellow-800',
  ELIMINAR_AGENTE_NOMINA: 'bg-red-100 text-red-700',
  EDITAR: 'bg-yellow-100 text-yellow-700',
  ACTIVAR: 'bg-green-100 text-green-700',
  DESACTIVAR: 'bg-red-100 text-red-700',
  CARGAR: 'bg-indigo-100 text-indigo-700',
  CONFIRMAR_CARGA_EXCEL: 'bg-teal-100 text-teal-700',
  REPLICAR_NOMINA: 'bg-blue-100 text-blue-700',
  EXPORTAR: 'bg-gray-100 text-gray-600',
  REGISTRAR: 'bg-indigo-100 text-indigo-700',
  CAMBIO: 'bg-blue-100 text-blue-700',
}

const ACTION_LABELS: Record<string, string> = {
  EDITAR_AGENTE_NOMINA: 'Edición nómina',
  ELIMINAR_AGENTE_NOMINA: 'Eliminación nómina',
  CONFIRMAR_CARGA_EXCEL: 'Carga Excel',
  REPLICAR_NOMINA: 'Replicar nómina',
}

function getActionColor(accion: string) {
  if (ACTION_COLORS[accion]) return ACTION_COLORS[accion]
  const key = Object.keys(ACTION_COLORS).find((k) => accion.startsWith(k))
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600'
}

function getActionLabel(accion: string) {
  return ACTION_LABELS[accion] || accion
}

const QUICK_FILTERS = [
  { label: 'Todo', accion: '' },
  { label: 'Cambios nómina', accion: 'EDITAR_AGENTE_NOMINA' },
  { label: 'Eliminaciones', accion: 'ELIMINAR_AGENTE_NOMINA' },
  { label: 'Cargas Excel', accion: 'CONFIRMAR_CARGA_EXCEL' },
]

export default function Auditoria() {
  const [page, setPage] = useState(1)
  const [quickFilter, setQuickFilter] = useState('')
  const [filters, setFilters] = useState({ usuario_id: '', desde: '', hasta: '' })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', page, filters, quickFilter],
    queryFn: () =>
      auditoriaApi.list({
        page,
        limit: 50,
        accion: quickFilter || undefined,
        usuario_id: filters.usuario_id || undefined,
        desde: filters.desde || undefined,
        hasta: filters.hasta || undefined,
      }).then((r) => r.data),
  })

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  const handleQuick = (accion: string) => {
    setQuickFilter(accion)
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Auditoría" subtitle={data ? `${data.total} registros` : ''} />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Quick filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.accion}
              onClick={() => handleQuick(qf.accion)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                quickFilter === qf.accion
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={quickFilter === qf.accion ? { backgroundColor: '#0054A6' } : {}}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="card p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label-base">Usuario</label>
              <select
                className="input-base"
                value={filters.usuario_id}
                onChange={(e) => { setFilters((f) => ({ ...f, usuario_id: e.target.value })); setPage(1) }}
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.rol === 'ADMINISTRADOR' ? 'Admin' : 'Supervisor'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-base">Desde</label>
              <input
                type="date"
                className="input-base"
                value={filters.desde}
                onChange={(e) => { setFilters((f) => ({ ...f, desde: e.target.value })); setPage(1) }}
              />
            </div>
            <div>
              <label className="label-base">Hasta</label>
              <input
                type="date"
                className="input-base"
                value={filters.hasta}
                onChange={(e) => { setFilters((f) => ({ ...f, hasta: e.target.value })); setPage(1) }}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <PageLoading />
        ) : !data?.data?.length ? (
          <EmptyState icon={Activity} title="Sin registros" description="No hay registros con los filtros aplicados." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">Fecha y hora</th>
                  <th className="table-th">Usuario</th>
                  <th className="table-th">Acción</th>
                  <th className="table-th">Servicio</th>
                  <th className="table-th">Campo</th>
                  <th className="table-th">Antes</th>
                  <th className="table-th">Después</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr key={log.id} className={`table-tr ${log.accion === 'ELIMINAR_AGENTE_NOMINA' ? 'bg-red-50/40' : log.accion === 'EDITAR_AGENTE_NOMINA' ? 'bg-yellow-50/40' : ''}`}>
                    <td className="table-td text-xs text-gray-500">
                      {format(new Date(log.fecha_hora), 'dd/MM/yy HH:mm', { locale: es })}
                    </td>
                    <td className="table-td">
                      <p className="text-xs font-semibold text-gray-700">{log.usuario?.nombre || '—'}</p>
                      <p className="text-xs text-gray-400">{log.usuario?.email}</p>
                    </td>
                    <td className="table-td">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.accion)}`}>
                        {getActionLabel(log.accion)}
                      </span>
                    </td>
                    <td className="table-td text-xs">
                      {log.servicio && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: log.servicio.color }} />
                          {log.servicio.nombre}
                        </span>
                      )}
                    </td>
                    <td className="table-td text-xs font-mono text-gray-600">{log.campo_modificado || '—'}</td>
                    <td className="table-td text-xs text-red-600 max-w-28 truncate" title={log.valor_anterior || ''}>{log.valor_anterior || '—'}</td>
                    <td className="table-td text-xs text-green-700 max-w-28 truncate" title={log.valor_nuevo || ''}>{log.valor_nuevo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Página {page} de {totalPages} · {data.total} registros</p>
              <div className="flex items-center gap-2">
                <button className="btn-ghost py-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft size={14} />
                </button>
                <button className="btn-ghost py-1" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
