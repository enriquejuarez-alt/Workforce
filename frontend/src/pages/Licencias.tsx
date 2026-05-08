import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Upload, FileText, X, Calendar } from 'lucide-react'
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
import { useAuthStore } from '../store/auth'

export default function Licencias() {
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const qc = useQueryClient()
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null)

  const { data: licencias = [], isLoading } = useQuery({
    queryKey: ['licencias', estadoFilter],
    queryFn: () => licenciasApi.list({ estado: estadoFilter || undefined }).then((r) => r.data),
  })

  const { data: importaciones = [] } = useQuery({
    queryKey: ['licencias-importaciones'],
    queryFn: () => licenciasApi.importaciones().then((r) => r.data),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => licenciasApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['licencias'] }); toast.success('Licencia eliminada'); setDeleteId(null) },
    onError: () => toast.error('Error al eliminar'),
  })

  const deleteImportMutation = useMutation({
    mutationFn: (id: number) => licenciasApi.deleteImportacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['licencias'] })
      qc.invalidateQueries({ queryKey: ['licencias-importaciones'] })
      toast.success('Archivo eliminado')
      setDeleteImportId(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Licencias"
        subtitle={`${licencias.length} licencias registradas`}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                <Upload size={14} /> Importar WF
              </button>
            )}
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Nueva licencia
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {/* Archivos importados */}
        {isAdmin && importaciones.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archivos importados</p>
            <div className="flex flex-wrap gap-2">
              {importaciones.map((imp) => (
                <div key={imp.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                  <Calendar size={13} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700 truncate max-w-[200px]">{imp.archivo_nombre}</p>
                    <p className="text-gray-400">{format(new Date(imp.fecha_importacion), 'dd/MM/yyyy HH:mm', { locale: es })} · {imp.total_periodos} licencias</p>
                  </div>
                  <button
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Eliminar archivo"
                    onClick={() => setDeleteImportId(imp.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <th className="table-th">Origen</th>
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
                    <td className="table-td">
                      {l.importacion_id ? (
                        <Badge variant="info">WF</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">Manual</span>
                      )}
                    </td>
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

      {showImport && (
        <ImportLicenciasModal
          onClose={() => setShowImport(false)}
          onSaved={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['licencias'] })
            qc.invalidateQueries({ queryKey: ['licencias-importaciones'] })
          }}
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

      <ConfirmDialog
        isOpen={!!deleteImportId}
        onClose={() => setDeleteImportId(null)}
        onConfirm={() => deleteImportId && deleteImportMutation.mutate(deleteImportId)}
        title="Eliminar archivo importado"
        message="Esto eliminará todas las licencias importadas de este archivo. ¿Continuar?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteImportMutation.isPending}
      />
    </div>
  )
}

function ImportLicenciasModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{
    total_periodos: number
    total_dias: number
    agentes_encontrados: number
    agentes_no_encontrados: number
    saltados_menos_14: number
  } | null>(null)

  const mutation = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return licenciasApi.importWF(fd)
    },
    onSuccess: (res) => {
      setResult(res.data)
      toast.success(`${res.data.total_periodos} licencias importadas`)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al importar'),
  })

  return (
    <Modal
      isOpen
      title="Importar licencias desde WF"
      onClose={onClose}
      size="md"
      footer={
        result ? (
          <button className="btn-primary" onClick={onSaved}>Cerrar</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={() => { if (!file) { toast.error('Seleccioná un archivo'); return } mutation.mutate(file) }} disabled={mutation.isPending}>
              {mutation.isPending ? 'Importando...' : 'Importar'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-green-700">Importación completada</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{result.total_periodos}</p>
              <p className="text-xs text-gray-500 mt-0.5">Licencias importadas</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{result.total_dias}</p>
              <p className="text-xs text-gray-500 mt-0.5">Días procesados</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.agentes_encontrados}</p>
              <p className="text-xs text-green-600 mt-0.5">Agentes en el sistema</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{result.agentes_no_encontrados}</p>
              <p className="text-xs text-yellow-600 mt-0.5">Sin match en el sistema</p>
            </div>
          </div>
          {result.saltados_menos_14 > 0 && (
            <p className="text-xs text-gray-400 text-center">{result.saltados_menos_14} períodos saltados por duración menor a 14 días</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Se importarán <strong>licencias, reservas de puesto y ausencias</strong> con duración <strong>mayor a 14 días</strong>. Las vacaciones serán ignoradas.
          </div>
          <div>
            <label className="label-base">Archivo de ausentismos WF (.xls / .xlsx)</label>
            <div
              className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-konecta transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-konecta" />
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  <button className="text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Clic para seleccionar archivo</p>
                  <p className="text-xs text-gray-400 mt-1">.xls o .xlsx</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
      )}
    </Modal>
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
