import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { nominasApi } from '../../lib/api'
import type { AgenteNominaMensual, NominaMensual } from '../../types'
import { usePermissions } from '../../hooks/usePermissions'

const CONTRATOS = ['30 horas', '35 horas', '36 horas']
const MODALIDADES = ['Híbrida', 'Presencial', 'Home Office']

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'select' | 'textarea'
  options?: string[]
}

interface Props {
  agent: AgenteNominaMensual
  nomina: NominaMensual
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  segmentosDisponibles?: string[]
  estadosDisponibles?: string[]
}

export default function EditAgentModal({ agent, nomina, isOpen, onClose, onSaved, segmentosDisponibles = [], estadosDisponibles = [] }: Props) {
  const { isAdmin, isFieldEditable } = usePermissions()

  const getFields = (): FieldDef[] => [
    { key: 'nombre', label: 'Nombre', type: 'text' },
    { key: 'dni', label: 'DNI', type: 'text' },
    { key: 'usuario', label: 'Usuario', type: 'text' },
    { key: 'superior', label: 'Superior', type: 'text' },
    {
      key: 'segmento', label: 'Segmento', type: segmentosDisponibles.length > 0 ? 'select' : 'text',
      options: segmentosDisponibles,
    },
    { key: 'horarios', label: 'Horarios', type: 'text' },
    {
      key: 'estado', label: 'Estado', type: estadosDisponibles.length > 0 ? 'select' : 'text',
      options: estadosDisponibles,
    },
    { key: 'contrato', label: 'Contrato', type: 'select', options: CONTRATOS },
    { key: 'sitio', label: 'Sitio', type: 'text' },
    { key: 'modalidad', label: 'Modalidad', type: 'select', options: MODALIDADES },
    { key: 'jefe', label: 'Jefe', type: 'text' },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
  ]

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      nombre: agent.nombre || '',
      dni: agent.dni || '',
      usuario: agent.usuario || '',
      superior: agent.superior || '',
      segmento: agent.segmento || '',
      horarios: agent.horarios || '',
      estado: agent.estado || '',
      contrato: agent.contrato || '',
      sitio: agent.sitio || '',
      modalidad: agent.modalidad || '',
      jefe: agent.jefe || '',
      observaciones: agent.observaciones || '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) => nominasApi.editAgente(agent.id, data),
    onSuccess: () => {
      toast.success('Agente actualizado correctamente')
      onSaved()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al guardar cambios')
    },
  })

  const onSubmit = (data: any) => {
    const filtered: any = {}
    for (const [key, val] of Object.entries(data)) {
      if (isAdmin || isFieldEditable(nomina.servicio_id, key)) {
        filtered[key] = val
      }
    }
    mutation.mutate(filtered)
  }

  const mesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][nomina.mes - 1]
  const fields = getFields()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar agente — ${agent.nombre}`}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending || !isDirty}
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800 font-medium">
          Editando nómina de <strong>{mesNombre} {nomina.anio}</strong>.
          {nomina.servicio?.nombre && ` Servicio: ${nomina.servicio.nombre}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ key, label, type, options }) => {
          const editable = isAdmin || isFieldEditable(nomina.servicio_id, key)
          return (
            <div key={key} className={key === 'observaciones' ? 'col-span-2' : ''}>
              <label className="label-base">
                {label}
                {!editable && <span className="ml-1 text-gray-300">(bloqueado)</span>}
              </label>
              {type === 'textarea' ? (
                <textarea
                  {...register(key as any)}
                  rows={2}
                  disabled={!editable}
                  className={`input-base resize-none ${!editable ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                />
              ) : type === 'select' && options && options.length > 0 ? (
                <select
                  {...register(key as any)}
                  disabled={!editable}
                  className={`input-base ${!editable ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                >
                  <option value="">— Sin especificar —</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  {...register(key as any)}
                  disabled={!editable}
                  className={`input-base ${!editable ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {!isAdmin && (
        <p className="mt-4 text-xs text-gray-400">
          Solo podés editar los campos autorizados por el administrador.
        </p>
      )}
    </Modal>
  )
}
