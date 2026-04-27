import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { serviciosApi } from '../lib/api'
import type { Servicio } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#6366F1','#8B5CF6','#EF4444','#0EA5E9','#F97316','#EC4899','#14B8A6']

export default function Servicios() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editServicio, setEditServicio] = useState<Servicio | null>(null)

  const { data: servicios = [], isLoading } = useQuery({
    queryKey: ['servicios-admin'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => serviciosApi.toggle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servicios-admin'] }); toast.success('Estado actualizado') },
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Gestión de Servicios"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Nuevo servicio
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicios.map((s) => (
            <div key={s.id} className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '20' }}>
                    <Building2 size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{s.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.descripcion || 'Sin descripción'}</p>
                  </div>
                </div>
                <Badge variant={s.activo ? 'success' : 'danger'} dot>{s.activo ? 'Activo' : 'Inactivo'}</Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                <span>{s._count?.agentes ?? 0} agentes</span>
                <span>·</span>
                <span>{s._count?.nominas ?? 0} nóminas</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Color:</span>
                  <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: s.color }} />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button className="btn-ghost py-1 px-2" onClick={() => setEditServicio(s)}>
                    <Edit2 size={13} />
                  </button>
                  <button
                    className={`btn-ghost py-1 px-2 ${s.activo ? 'text-red-500' : 'text-green-500'}`}
                    onClick={() => toggleMutation.mutate(s.id)}
                  >
                    {s.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(showForm || editServicio) && (
        <ServicioFormModal
          servicio={editServicio || undefined}
          onClose={() => { setShowForm(false); setEditServicio(null) }}
          onSaved={() => { setShowForm(false); setEditServicio(null); qc.invalidateQueries({ queryKey: ['servicios-admin'] }) }}
        />
      )}
    </div>
  )
}

function ServicioFormModal({ servicio, onClose, onSaved }: { servicio?: Servicio; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      nombre: servicio?.nombre || '',
      descripcion: servicio?.descripcion || '',
      color: servicio?.color || '#6366F1',
    },
  })
  const color = watch('color')

  const mutation = useMutation({
    mutationFn: (data: any) =>
      servicio ? serviciosApi.update(servicio.id, data) : serviciosApi.create(data),
    onSuccess: () => { toast.success(servicio ? 'Servicio actualizado' : 'Servicio creado'); onSaved() },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <Modal isOpen title={servicio ? 'Editar servicio' : 'Nuevo servicio'} onClose={onClose} size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-base">Nombre *</label>
          <input {...register('nombre', { required: 'Requerido' })} className="input-base" />
          {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label-base">Descripción</label>
          <textarea {...register('descripcion')} rows={2} className="input-base resize-none" />
        </div>
        <div>
          <label className="label-base">Color visual</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setValue('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input {...register('color')} type="color" className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
            <span className="text-xs text-gray-500 font-mono">{color}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
