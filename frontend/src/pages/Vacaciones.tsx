import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Trash2, Search, Calendar, X } from 'lucide-react'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import { vacacionesApi } from '../lib/api'
import type { Vacacion, VacacionImportacion } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { useAuthStore } from '../store/auth'

function VacacionBadge({ estado }: { estado: 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA' }) {
  const map = {
    VIGENTE:    { label: 'Vigente',    variant: 'success' as const },
    PROGRAMADA: { label: 'Programada', variant: 'info' as const },
    FINALIZADA: { label: 'Finalizada', variant: 'gray' as const },
  }
  const { label, variant } = map[estado]
  return <Badge variant={variant} dot>{label}</Badge>
}

export default function Vacaciones() {
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null)

  const { data: vacaciones = [], isLoading } = useQuery({
    queryKey: ['vacaciones', search, estadoFilter],
    queryFn: () =>
      vacacionesApi.list({
        search: search || undefined,
        estado: estadoFilter || undefined,
      }).then((r) => r.data),
  })

  const { data: importaciones = [] } = useQuery({
    queryKey: ['vacaciones-importaciones'],
    queryFn: () => vacacionesApi.importaciones().then((r) => r.data),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vacacionesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vacaciones'] })
      toast.success('Registro eliminado')
      setDeleteId(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const deleteImportMutation = useMutation({
    mutationFn: (id: number) => vacacionesApi.deleteImportacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vacaciones'] })
      qc.invalidateQueries({ queryKey: ['vacaciones-importaciones'] })
      toast.success('Archivo eliminado')
      setDeleteImportId(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Vacaciones"
        subtitle={`${vacaciones.length} períodos registrados`}
        actions={
          isAdmin && (
            <button className="btn-primary" onClick={() => setShowImport(true)}>
              <Upload size={14} /> Importar archivo WF
            </button>
          )
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
                    <p className="text-gray-400">{format(new Date(imp.fecha_importacion), 'dd/MM/yyyy HH:mm', { locale: es })} · {imp.total_periodos} períodos</p>
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
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-base pl-8 w-56"
              placeholder="Buscar agente o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
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

        {vacaciones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sin vacaciones registradas"
            description={
              search || estadoFilter
                ? 'No hay resultados con los filtros aplicados.'
                : 'Importá un archivo de ausentismos WF para ver las vacaciones asignadas.'
            }
            action={
              isAdmin && !search && !estadoFilter ? (
                <button className="btn-primary" onClick={() => setShowImport(true)}>
                  <Upload size={14} /> Importar archivo WF
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">Agente</th>
                  <th className="table-th">DNI</th>
                  <th className="table-th">Servicio (sistema)</th>
                  <th className="table-th">Site WF</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Días</th>
                  <th className="table-th">Estado</th>
                  {isAdmin && <th className="table-th">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {vacaciones.map((v) => {
                  const dias = differenceInCalendarDays(new Date(v.fecha_hasta), new Date(v.fecha_desde)) + 1
                  return (
                    <tr key={v.id} className="table-tr">
                      <td className="table-td">
                        <p className="font-semibold text-gray-800 text-sm">{v.agente_nombre}</p>
                        {v.servicio_wf && (
                          <p className="text-xs text-gray-400">{v.servicio_wf}</p>
                        )}
                      </td>
                      <td className="table-td text-xs text-gray-600">{v.agente_dni}</td>
                      <td className="table-td text-xs">
                        {v.agente?.servicio ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: v.agente.servicio.color }}
                          >
                            {v.agente.servicio.nombre}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No encontrado</span>
                        )}
                      </td>
                      <td className="table-td text-xs text-gray-500">{v.site || '—'}</td>
                      <td className="table-td text-xs font-medium">
                        {format(new Date(v.fecha_desde), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="table-td text-xs font-medium">
                        {format(new Date(v.fecha_hasta), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="table-td">
                        <span className="text-xs font-semibold text-gray-700">{dias}d</span>
                      </td>
                      <td className="table-td">
                        <VacacionBadge estado={v.estado_calculado || 'FINALIZADA'} />
                      </td>
                      {isAdmin && (
                        <td className="table-td">
                          <button
                            className="btn-ghost py-1 px-2 text-red-500"
                            onClick={() => setDeleteId(v.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['vacaciones'] })
            qc.invalidateQueries({ queryKey: ['vacaciones-importaciones'] })
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Eliminar período de vacaciones"
        message="¿Seguro querés eliminar este período? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteImportId}
        onClose={() => setDeleteImportId(null)}
        onConfirm={() => deleteImportId && deleteImportMutation.mutate(deleteImportId)}
        title="Eliminar archivo importado"
        message="Esto eliminará todos los períodos de vacaciones de este archivo. ¿Continuar?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteImportMutation.isPending}
      />
    </div>
  )
}

function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{
    total_dias: number
    total_periodos: number
    agentes_encontrados: number
    agentes_no_encontrados: number
  } | null>(null)

  const mutation = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return vacacionesApi.import(fd)
    },
    onSuccess: (res) => {
      setResult(res.data)
      toast.success(`${res.data.total_periodos} períodos importados`)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al importar'),
  })

  const handleSubmit = () => {
    if (!file) return toast.error('Seleccioná un archivo')
    mutation.mutate(file)
  }

  return (
    <Modal
      isOpen
      title="Importar vacaciones desde WF"
      onClose={onClose}
      size="md"
      footer={
        result ? (
          <button className="btn-primary" onClick={onSaved}>Cerrar</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
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
              <p className="text-xs text-gray-500 mt-0.5">Períodos importados</p>
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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Solo se importarán los registros con motivo <strong>VACACIONES</strong>. Ausentismos y licencias serán ignorados.
          </div>
          <div>
            <label className="label-base">Archivo de ausentismos WF (.xls / .xlsx)</label>
            <div
              className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-konecta transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <Calendar size={16} className="text-konecta" />
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  <button
                    className="text-gray-400 hover:text-red-500"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  >
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
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

