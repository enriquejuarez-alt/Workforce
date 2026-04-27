import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Filter, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Badge, { LicenciaBadge } from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import { useForm } from 'react-hook-form'
import { licenciasApi, agentesApi } from '../lib/api'
import type { Licencia } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { FileText } from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function Licencias() {
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const qc = useQueryClient()
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: licencias = [], isLoading } = useQuery({
    queryKey: ['licencias', estadoFilter],
    queryFn: () => licenciasApi.list({ estado: estadoFilter || undefined }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => licenciasApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['licencias'] }); toast.success('Licencia eliminada'); setDeleteId(null) },
    onError: () => toast.error('Error al eliminar'),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Licencias"
        subtitle={`${licencias.length} licencias registradas`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Nueva licencia
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filtros */}
        <div className="flex items-center gap-3 mb-4">
          <select
            className="input-base w-44"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="VIGENTE">Vigentes</option>
            <option value="PROGRAMADA">Programadas</option>
            <option value="FINALIZADA">Finalizadas</option>
          </select>
        </div>

        {licencias.length === 0 ? (
          <EmptyState icon={FileText} title="Sin licencias" description="No hay licencias registradas con los filtros aplicados." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Motivo</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Registrado por</th>
                  {isAdmin && <th className="table-th">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {licencias.map((l) => (
                  <tr key={l.id} className="table-tr">
                    <td className="table-td">
                      <p className="font-semibold text-gray-800 text-sm">{l.agente?.nombre}</p>
                      <p className="text-xs text-gray-400">{l.agente?.usuario}</p>
                    </td>
                    <td className="table-td text-xs">{l.agente?.servicio?.nombre || '—'}</td>
                    <td className="table-td text-xs">{format(new Date(l.fecha_desde), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td text-xs">{format(new Date(l.fecha_hasta), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td text-xs text-gray-500">{l.motivo || '—'}</td>
                    <td className="table-td">
                      <LicenciaBadge tipo={l.estado_calculado || 'FINALIZADA'} />
                    </td>
                    <td className="table-td text-xs text-gray-500">{l.creador?.nombre || '—'}</td>
                    {isAdmin && (
                      <td className="table-td">
                        <button className="btn-ghost py-1 px-2 text-red-500" onClick={() => setDeleteId(l.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLicenciaModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['licencias'] }) }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Eliminar licencia"
        message="¿Seguro querés eliminar esta licencia? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function CreateLicenciaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      agente_id: '',
      fecha_desde: format(new Date(), 'yyyy-MM-dd'),
      fecha_hasta: format(new Date(), 'yyyy-MM-dd'),
      motivo: '',
      observacion: '',
    },
  })

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes-activos'],
    queryFn: () => agentesApi.list({ activo: 'true' }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => licenciasApi.create({ ...data, agente_id: parseInt(data.agente_id) }),
    onSuccess: () => { toast.success('Licencia registrada'); onSaved() },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <Modal isOpen title="Nueva licencia" onClose={onClose} size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Registrar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-base">Agente *</label>
          <select {...register('agente_id', { required: 'Requerido' })} className="input-base">
            <option value="">Seleccionar agente...</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre} ({a.dni})</option>)}
          </select>
          {errors.agente_id && <p className="text-xs text-red-600 mt-1">{errors.agente_id.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Fecha desde *</label>
            <input type="date" {...register('fecha_desde', { required: 'Requerido' })} className="input-base" />
          </div>
          <div>
            <label className="label-base">Fecha hasta *</label>
            <input type="date" {...register('fecha_hasta', { required: 'Requerido' })} className="input-base" />
          </div>
        </div>
        <div>
          <label className="label-base">Motivo</label>
          <input {...register('motivo')} className="input-base" placeholder="Ej: Licencia médica" />
        </div>
        <div>
          <label className="label-base">Observaciones</label>
          <textarea {...register('observacion')} rows={2} className="input-base resize-none" />
        </div>
      </div>
    </Modal>
  )
}
