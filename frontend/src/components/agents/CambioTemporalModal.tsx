import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { cambiosApi } from '../../lib/api'
import type { AgenteNominaMensual, Servicio } from '../../types'
import { format } from 'date-fns'

interface Props {
  agente: AgenteNominaMensual
  servicios: Servicio[]
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function CambioTemporalModal({ agente, servicios, isOpen, onClose, onSaved }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      servicio_temporal_id: '',
      fecha_desde: today,
      fecha_hasta: today,
      motivo: '',
      observacion: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      cambiosApi.create({
        ...data,
        agente_id: agente.agente_id,
        servicio_original_id: agente.servicio_id,
        servicio_temporal_id: parseInt(data.servicio_temporal_id),
      }),
    onSuccess: () => {
      toast.success('Cambio temporal registrado')
      onSaved()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al registrar cambio')
    },
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cambio temporal — ${agente.nombre}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Registrar cambio'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            Servicio original: <strong>{agente.servicio?.nombre || `ID ${agente.servicio_id}`}</strong>
          </p>
        </div>

        <div>
          <label className="label-base">Servicio temporal *</label>
          <select
            {...register('servicio_temporal_id', { required: 'Requerido' })}
            className="input-base"
          >
            <option value="">Seleccionar servicio...</option>
            {servicios
              .filter((s) => s.activo && s.id !== agente.servicio_id)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
          </select>
          {errors.servicio_temporal_id && <p className="text-xs text-red-600 mt-1">{errors.servicio_temporal_id.message}</p>}
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
          <input {...register('motivo')} className="input-base" placeholder="Motivo del cambio temporal..." />
        </div>
        <div>
          <label className="label-base">Observaciones</label>
          <textarea {...register('observacion')} rows={2} className="input-base resize-none" />
        </div>
      </div>
    </Modal>
  )
}
