import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { licenciasApi } from '../../lib/api'
import type { AgenteNominaMensual } from '../../types'
import { format } from 'date-fns'

interface Props {
  agente: AgenteNominaMensual
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function LicenciaModal({ agente, isOpen, onClose, onSaved }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    defaultValues: { fecha_desde: today, fecha_hasta: today, motivo: '', observacion: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      licenciasApi.create({ ...data, agente_id: agente.agente_id }),
    onSuccess: () => {
      toast.success('Licencia registrada correctamente')
      reset()
      onSaved()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al registrar licencia')
    },
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar licencia — ${agente.nombre}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Registrar licencia'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Fecha desde *</label>
            <input type="date" {...register('fecha_desde', { required: 'Requerido' })} className="input-base" />
            {errors.fecha_desde && <p className="text-xs text-red-600 mt-1">{errors.fecha_desde.message}</p>}
          </div>
          <div>
            <label className="label-base">Fecha hasta *</label>
            <input type="date" {...register('fecha_hasta', { required: 'Requerido' })} className="input-base" />
            {errors.fecha_hasta && <p className="text-xs text-red-600 mt-1">{errors.fecha_hasta.message}</p>}
          </div>
        </div>
        <div>
          <label className="label-base">Motivo</label>
          <input {...register('motivo')} className="input-base" placeholder="Ej: Licencia médica" />
        </div>
        <div>
          <label className="label-base">Observaciones</label>
          <textarea {...register('observacion')} rows={3} className="input-base resize-none" placeholder="Detalles adicionales..." />
        </div>
      </div>
    </Modal>
  )
}
