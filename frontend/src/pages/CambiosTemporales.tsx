import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Badge, { CambioTemporalBadge } from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import { useForm } from 'react-hook-form'
import { cambiosApi, agentesApi, serviciosApi } from '../lib/api'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { useAuthStore } from '../store/auth'

export default function CambiosTemporales() {
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const qc = useQueryClient()
  const [activoFilter, setActivoFilter] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: cambios = [], isLoading } = useQuery({
    queryKey: ['cambios', activoFilter],
    queryFn: () => cambiosApi.list({ activo: activoFilter ? 'true' : undefined }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cambiosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios'] }); toast.success('Eliminado'); setDeleteId(null) },
    onError: () => toast.error('Error al eliminar'),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Cambios Temporales de Servicio"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Nuevo cambio
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" className="rounded accent-konecta" checked={activoFilter} onChange={(e) => setActivoFilter(e.target.checked)} />
            Solo cambios activos
          </label>
        </div>

        {cambios.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Sin cambios temporales" description="No hay cambios temporales registrados." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio original</th>
                  <th className="table-th">Servicio temporal</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Motivo</th>
                  {isAdmin && <th className="table-th">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td">
                      <p className="font-semibold text-gray-800 text-sm">{c.agente?.nombre}</p>
                      <p className="text-xs text-gray-400">{c.agente?.usuario}</p>
                    </td>
                    <td className="table-td text-xs">{c.agente?.servicio?.nombre || `ID ${c.servicio_original_id}`}</td>
                    <td className="table-td text-xs">{c.servicio_temporal?.nombre || '—'}</td>
                    <td className="table-td text-xs">{format(new Date(c.fecha_desde), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td text-xs">{format(new Date(c.fecha_hasta), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td">
                      {c.activo ? <CambioTemporalBadge /> : <Badge variant="gray">Finalizado</Badge>}
                    </td>
                    <td className="table-td text-xs text-gray-500">{c.motivo || '—'}</td>
                    {isAdmin && (
                      <td className="table-td">
                        <button className="btn-ghost py-1 px-2 text-red-500" onClick={() => setDeleteId(c.id)}>
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
        <CreateCambioModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['cambios'] }) }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Eliminar cambio temporal"
        message="¿Seguro querés eliminar este cambio temporal?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function CreateCambioModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { agente_id: '', servicio_temporal_id: '', fecha_desde: today, fecha_hasta: today, motivo: '', observacion: '' },
  })

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes-activos'],
    queryFn: () => agentesApi.list({ activo: 'true' }).then((r) => r.data),
  })

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => cambiosApi.create({
      ...data,
      agente_id: parseInt(data.agente_id),
      servicio_temporal_id: parseInt(data.servicio_temporal_id),
    }),
    onSuccess: () => { toast.success('Cambio temporal registrado'); onSaved() },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <Modal isOpen title="Nuevo cambio temporal" onClose={onClose} size="md"
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
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre} — {a.servicio?.nombre || 'Sin servicio'}</option>)}
          </select>
          {errors.agente_id && <p className="text-xs text-red-600 mt-1">{errors.agente_id.message}</p>}
        </div>
        <div>
          <label className="label-base">Servicio temporal *</label>
          <select {...register('servicio_temporal_id', { required: 'Requerido' })} className="input-base">
            <option value="">Seleccionar servicio...</option>
            {servicios.filter((s: any) => s.activo).map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
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
          <input {...register('motivo')} className="input-base" />
        </div>
        <div>
          <label className="label-base">Observaciones</label>
          <textarea {...register('observacion')} rows={2} className="input-base resize-none" />
        </div>
      </div>
    </Modal>
  )
}
