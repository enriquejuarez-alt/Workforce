import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Edit2, ToggleLeft, ToggleRight, Shield, CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { usersApi, serviciosApi } from '../lib/api'
import type { Usuario, Servicio, UsuarioServicioPermiso } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Usuarios() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [permisoUser, setPermisoUser] = useState<Usuario | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => usersApi.toggle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Estado actualizado') },
    onError: () => toast.error('Error al cambiar estado'),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Gestión de Usuarios"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} /> Nuevo usuario
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-th">Usuario</th>
                <th className="table-th">Rol</th>
                <th className="table-th">Estado</th>
                <th className="table-th">Servicios</th>
                <th className="table-th">Último acceso</th>
                <th className="table-th">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="table-tr">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-konecta flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{user.nombre.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{user.nombre}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <Badge variant={user.rol === 'ADMINISTRADOR' ? 'orange' : 'purple'}>
                      {user.rol === 'ADMINISTRADOR' ? 'Admin' : 'Supervisor'}
                    </Badge>
                  </td>
                  <td className="table-td">
                    <Badge variant={user.activo ? 'success' : 'danger'} dot>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="table-td">
                    <span className="text-xs text-gray-600">
                      {user.permisos?.length ?? 0} servicio{(user.permisos?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {user.ultimo_acceso
                      ? format(new Date(user.ultimo_acceso), 'dd/MM/yyyy HH:mm', { locale: es })
                      : 'Nunca'}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1.5">
                      <button className="btn-ghost py-1 px-2" onClick={() => setEditUser(user)} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn-ghost py-1 px-2"
                        onClick={() => setPermisoUser(user)}
                        title="Gestionar permisos"
                      >
                        <Shield size={13} />
                      </button>
                      <button
                        className={`btn-ghost py-1 px-2 ${user.activo ? 'text-red-500' : 'text-green-500'}`}
                        onClick={() => toggleMutation.mutate(user.id)}
                        title={user.activo ? 'Desactivar' : 'Activar'}
                      >
                        {user.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <UserFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['usuarios'] }) }}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); qc.invalidateQueries({ queryKey: ['usuarios'] }) }}
        />
      )}

      {permisoUser && (
        <PermisosModal
          user={permisoUser}
          onClose={() => setPermisoUser(null)}
        />
      )}
    </div>
  )
}

function UserFormModal({ user, onClose, onSaved }: { user?: Usuario; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nombre: user?.nombre || '',
      email: user?.email || '',
      password: '',
      rol: user?.rol || 'USUARIO',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      user ? usersApi.update(user.id, data) : usersApi.create(data),
    onSuccess: () => { toast.success(user ? 'Usuario actualizado' : 'Usuario creado'); onSaved() },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <Modal isOpen title={user ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose} size="md"
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
          <label className="label-base">Nombre completo *</label>
          <input {...register('nombre', { required: 'Requerido' })} className="input-base" />
          {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label-base">Email *</label>
          <input {...register('email', { required: 'Requerido' })} type="email" className="input-base" />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label-base">Contraseña {user ? '(dejar vacío para no cambiar)' : '*'}</label>
          <input {...register('password', { required: !user ? 'Requerida' : false })} type="password" className="input-base" />
          {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label-base">Rol</label>
          <select {...register('rol')} className="input-base">
            <option value="USUARIO">Supervisor</option>
            <option value="ADMINISTRADOR">Administrador</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

const ALL_CAMPOS = [
  { key: 'NOMBRE', label: 'Nombre' },
  { key: 'DNI', label: 'DNI' },
  { key: 'USUARIO', label: 'Usuario sistema' },
  { key: 'SUPERIOR', label: 'Superior' },
  { key: 'SEGMENTO', label: 'Segmento' },
  { key: 'HORARIOS', label: 'Horarios' },
  { key: 'ESTADO', label: 'Estado' },
  { key: 'CONTRATO', label: 'Contrato' },
  { key: 'SITIO', label: 'Sitio' },
  { key: 'MODALIDAD', label: 'Modalidad' },
  { key: 'JEFE', label: 'Jefe' },
  { key: 'OBSERVACIONES', label: 'Observaciones' },
]

// Converts campos_editables (allow-list) → campos_bloqueados (block-list)
// campos_editables = []  → sin restricción → nada bloqueado
// campos_editables = ['HORARIOS'] → solo ese editable → todo lo demás bloqueado
function toBloqueados(camposEditables: string[]): string[] {
  if (camposEditables.length === 0) return []
  return ALL_CAMPOS.map((c) => c.key).filter((k) => !camposEditables.includes(k))
}

// Converts campos_bloqueados → campos_editables
function toEditables(camposBloqueados: string[]): string[] {
  if (camposBloqueados.length === 0) return []
  return ALL_CAMPOS.map((c) => c.key).filter((k) => !camposBloqueados.includes(k))
}

const PERMISO_FIELDS = [
  { key: 'puede_ver', label: 'Ver nómina' },
  { key: 'puede_usar_filtros', label: 'Usar filtros' },
  { key: 'puede_editar_nomina_mes_corriente', label: 'Editar mes corriente' },
  { key: 'puede_ver_nominas_historicas', label: 'Ver históricas' },
  { key: 'puede_editar_nominas_historicas', label: 'Editar históricas' },
  { key: 'puede_cargar_excel', label: 'Cargar Excel' },
  { key: 'puede_exportar', label: 'Exportar' },
  { key: 'puede_exportar_nominas_historicas', label: 'Exportar históricas' },
  { key: 'puede_registrar_licencia', label: 'Registrar licencias' },
  { key: 'puede_registrar_cambio_servicio', label: 'Registrar cambios temporales' },
  { key: 'puede_crear_agente', label: 'Crear agentes' },
  { key: 'puede_desactivar_agente', label: 'Desactivar agentes' },
  { key: 'puede_comparar_nominas_mensuales', label: 'Comparar nóminas' },
]

function PermisosModal({ user, onClose }: { user: Usuario; onClose: () => void }) {
  const qc = useQueryClient()
  const [selectedServicio, setSelectedServicio] = useState<number | null>(null)
  const [permisos, setPermisos] = useState<Partial<UsuarioServicioPermiso>>({})
  const [camposBloqueados, setCamposBloqueados] = useState<string[]>([])
  const [segmentosSeleccionados, setSegmentosSeleccionados] = useState<string[]>([])

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: userPermisos = [] } = useQuery({
    queryKey: ['user-permisos', user.id],
    queryFn: () => usersApi.getPermissions(user.id).then((r) => r.data),
  })

  const { data: segmentosDisponibles = [] } = useQuery({
    queryKey: ['servicio-segmentos', selectedServicio],
    queryFn: () => serviciosApi.segmentos(selectedServicio!).then((r) => r.data),
    enabled: selectedServicio !== null,
  })

  const selectServicio = (sId: number) => {
    setSelectedServicio(sId)
    const existing = userPermisos.find((p) => p.servicio_id === sId)
    if (existing) {
      setPermisos(existing)
      setCamposBloqueados(toBloqueados(existing.campos_editables ?? []))
      setSegmentosSeleccionados(existing.segmentos_permitidos ?? [])
    } else {
      setPermisos({})
      setCamposBloqueados([])
      setSegmentosSeleccionados([])
    }
  }

  const toggleSegmento = (seg: string) => {
    setSegmentosSeleccionados((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    )
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      return usersApi.setPermission(user.id, selectedServicio!, {
        ...permisos,
        campos_editables: toEditables(camposBloqueados),
        segmentos_permitidos: segmentosSeleccionados,
      })
    },
    onSuccess: () => {
      toast.success('Permisos guardados')
      qc.invalidateQueries({ queryKey: ['user-permisos', user.id] })
      qc.invalidateQueries({ queryKey: ['usuarios'] })
    },
    onError: () => toast.error('Error al guardar permisos'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deletePermission(user.id, selectedServicio!),
    onSuccess: () => {
      toast.success('Acceso revocado')
      qc.invalidateQueries({ queryKey: ['user-permisos', user.id] })
      setSelectedServicio(null)
    },
    onError: () => toast.error('Error'),
  })

  return (
    <Modal isOpen title={`Permisos — ${user.nombre}`} onClose={onClose} size="2xl">
      <div className="flex gap-4 h-[560px]">
        {/* Servicios list */}
        <div className="w-52 shrink-0 border-r border-gray-100 pr-4 overflow-y-auto">
          <p className="section-title mb-3">Servicios</p>
          {servicios.filter((s: Servicio) => s.activo).map((s: Servicio) => {
            const hasAccess = userPermisos.some((p) => p.servicio_id === s.id)
            return (
              <button
                key={s.id}
                onClick={() => selectServicio(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5 flex items-center gap-2 ${
                  selectedServicio === s.id ? 'bg-konecta/10 text-konecta font-semibold' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate">{s.nombre}</span>
                {hasAccess && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Permisos form */}
        {selectedServicio ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            <p className="section-title">
              {servicios.find((s: Servicio) => s.id === selectedServicio)?.nombre}
            </p>

            {/* Permisos checkboxes */}
            <div className="grid grid-cols-2 gap-1">
              {PERMISO_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="rounded accent-konecta"
                    checked={(permisos as any)[key] || false}
                    onChange={(e) => setPermisos((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Segmentos permitidos */}
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">
                  Segmentos visibles
                </label>
                {segmentosSeleccionados.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => setSegmentosSeleccionados([])}
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
              {segmentosDisponibles.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No hay segmentos cargados para este servicio. Importá una nómina primero.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {segmentosDisponibles.map((seg) => {
                    const selected = segmentosSeleccionados.includes(seg)
                    return (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => toggleSegmento(seg)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'border-konecta bg-konecta text-white'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-konecta hover:text-konecta'
                        }`}
                      >
                        {seg}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {segmentosSeleccionados.length === 0
                  ? 'Sin restricción — verá todos los segmentos del servicio'
                  : `Solo verá: ${segmentosSeleccionados.join(', ')}`}
              </p>
            </div>

            {/* Campos bloqueados */}
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">
                  Campos que NO puede editar
                </label>
                {camposBloqueados.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-konecta transition-colors"
                    onClick={() => setCamposBloqueados([])}
                  >
                    Desbloquear todo
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {ALL_CAMPOS.map(({ key, label }) => {
                  const bloqueado = camposBloqueados.includes(key)
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded transition-colors ${
                        bloqueado ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={bloqueado}
                        onChange={(e) =>
                          setCamposBloqueados((prev) =>
                            e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)
                          )
                        }
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {camposBloqueados.length === 0
                  ? 'Sin restricciones — puede editar todos los campos'
                  : `Bloqueados: ${camposBloqueados.map((k) => ALL_CAMPOS.find((c) => c.key === k)?.label ?? k).join(', ')}`}
              </p>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                className="btn-primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar permisos'}
              </button>
              {userPermisos.some((p) => p.servicio_id === selectedServicio) && (
                <button
                  className="btn-danger"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Revocar acceso
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Seleccioná un servicio para configurar permisos
          </div>
        )}
      </div>
    </Modal>
  )
}
