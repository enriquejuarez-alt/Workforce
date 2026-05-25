"use client";

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Edit2, Shield, CheckCircle2, MoreHorizontal, PowerOff, Power } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Header from '@/components/hr/layout/Header'
import Modal from '@/components/hr/ui/Modal'
import Badge from '@/components/hr/ui/Badge'
import { usersApi, serviciosApi } from '@/lib/api'
import type { Usuario, Servicio, UsuarioServicioPermiso } from '@/types'
import { ROL_LABELS, ROL_BADGE_VARIANT } from '@/lib/utils/roles'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function ActionMenu({ user, onEdit, onPermisos, onToggle, isPending }: {
  user: Usuario
  onEdit: () => void
  onPermisos: () => void
  onToggle: () => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-ghost py-1 px-2 text-gray-400 hover:text-gray-700"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => { setOpen(false); onEdit() }}
          >
            <Edit2 size={13} /> Editar usuario
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => { setOpen(false); onPermisos() }}
          >
            <Shield size={13} /> Gestionar permisos
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${user.activo ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
            onClick={() => { setOpen(false); onToggle() }}
            disabled={isPending}
          >
            {user.activo ? <PowerOff size={13} /> : <Power size={13} />}
            {user.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}
    </div>
  )
}

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
                    <Badge variant={ROL_BADGE_VARIANT[user.rol] as any}>
                      {ROL_LABELS[user.rol]}
                    </Badge>
                  </td>
                  <td className="table-td">
                    <Badge variant={user.activo ? 'success' : 'danger'} dot>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="table-td">
                    {/* Líder: mostrar servicio directo */}
                    {user.rol === 'LIDER' && user.servicio ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: user.servicio.color }} />
                        {user.servicio.nombre}
                      </span>
                    ) : user.permisos && user.permisos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.permisos.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.servicio?.color ?? '#ccc' }} />
                            {p.servicio?.nombre ?? '—'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Sin servicios</span>
                    )}
                  </td>
                  <td className="table-td">
                    {user.ultimo_acceso ? (
                      <span className="text-xs text-gray-500">
                        {format(new Date(user.ultimo_acceso), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">
                        Sin acceso aún
                      </span>
                    )}
                  </td>
                  <td className="table-td">
                    <ActionMenu
                      user={user}
                      onEdit={() => setEditUser(user)}
                      onPermisos={() => setPermisoUser(user)}
                      onToggle={() => toggleMutation.mutate(user.id)}
                      isPending={toggleMutation.isPending}
                    />
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
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      nombre: user?.nombre || '',
      email: user?.email || '',
      password: '',
      rol: user?.rol || 'USUARIO',
      servicio_id: user?.servicio_id ? String(user.servicio_id) : '',
    },
  })

  const rolSeleccionado = watch('rol')

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })
  const serviciosActivos = (servicios as Servicio[]).filter((s) => s.activo)

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        servicio_id: data.servicio_id ? parseInt(data.servicio_id) : null,
      }
      return user ? usersApi.update(user.id, payload) : usersApi.create(payload)
    },
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
            <option value="USUARIO">Supervisor (legacy)</option>
            <option value="WORKFORCE">Workforce</option>
            <option value="CAPACITADOR">Capacitador</option>
            <option value="LIDER">Líder de servicio</option>
            <option value="ADMINISTRADOR">Administrador</option>
          </select>
        </div>
        {rolSeleccionado === 'LIDER' && (
          <div>
            <label className="label-base">Servicio asignado *</label>
            <select
              {...register('servicio_id', { required: rolSeleccionado === 'LIDER' ? 'Requerido para Líder' : false })}
              className="input-base"
            >
              <option value="">— Seleccionar servicio —</option>
              {serviciosActivos.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.nombre}</option>
              ))}
            </select>
            {errors.servicio_id && <p className="text-xs text-red-600 mt-1">{errors.servicio_id.message}</p>}
            <p className="text-xs text-gray-400 mt-1">El Líder solo verá datos de este servicio.</p>
          </div>
        )}
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
    mutationFn: () =>
      usersApi.setPermission(user.id, selectedServicio!, {
        ...permisos,
        campos_editables: toEditables(camposBloqueados),
        segmentos_permitidos: segmentosSeleccionados,
      }),
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

  const serviciosActivos = servicios.filter((s: Servicio) => s.activo)
  const servicioActual = serviciosActivos.find((s: Servicio) => s.id === selectedServicio)

  return (
    <Modal isOpen title={`Permisos — ${user.nombre}`} onClose={onClose} size="2xl">
      <div className="flex gap-4 h-[560px]">

        {/* Lista de servicios */}
        <div className="w-48 shrink-0 flex flex-col gap-0.5 overflow-y-auto">
          <p className="section-title mb-2">Servicios</p>
          {serviciosActivos.map((s: Servicio) => {
            const hasAccess = userPermisos.some((p) => p.servicio_id === s.id)
            const isSelected = selectedServicio === s.id
            return (
              <button
                key={s.id}
                onClick={() => selectServicio(s.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all w-full text-left ${
                  isSelected
                    ? 'bg-konecta/10 text-konecta font-semibold ring-1 ring-konecta/30'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate text-xs">{s.nombre}</span>
                {hasAccess && <CheckCircle2 size={11} className="text-green-500 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Permisos */}
        <div className="flex-1 overflow-y-auto">
          {!selectedServicio ? (
            <div className="h-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
              <Shield size={28} className="mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-400">Seleccioná un servicio</p>
            </div>
          ) : (
            <div className="space-y-4 p-1">
              {/* Header servicio */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: servicioActual?.color }} />
                <p className="font-semibold text-gray-800 text-sm">{servicioActual?.nombre}</p>
                {userPermisos.some((p) => p.servicio_id === selectedServicio) && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Con acceso
                  </span>
                )}
              </div>

              {/* Permisos checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">Permisos</span>
                  <button
                    type="button"
                    className="text-xs text-konecta hover:underline"
                    onClick={() => {
                      const allChecked = PERMISO_FIELDS.every(({ key }) => (permisos as any)[key])
                      const next = Object.fromEntries(PERMISO_FIELDS.map(({ key }) => [key, !allChecked]))
                      setPermisos((p) => ({ ...p, ...next }))
                    }}
                  >
                    {PERMISO_FIELDS.every(({ key }) => (permisos as any)[key]) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>
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
              </div>

              {/* Segmentos visibles */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Segmentos visibles</label>
                  {segmentosSeleccionados.length > 0 && (
                    <button type="button" className="text-xs text-gray-400 hover:text-red-500 transition-colors" onClick={() => setSegmentosSeleccionados([])}>
                      Limpiar
                    </button>
                  )}
                </div>
                {segmentosDisponibles.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No hay segmentos — importá una nómina primero.</p>
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
                            selected ? 'border-konecta bg-konecta text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-konecta hover:text-konecta'
                          }`}
                        >
                          {seg}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {segmentosSeleccionados.length === 0 ? 'Sin restricción — verá todos los segmentos' : `Solo verá: ${segmentosSeleccionados.join(', ')}`}
                </p>
              </div>

              {/* Campos bloqueados */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Campos que NO puede editar</label>
                  {camposBloqueados.length > 0 && (
                    <button type="button" className="text-xs text-gray-400 hover:text-konecta transition-colors" onClick={() => setCamposBloqueados([])}>
                      Desbloquear todo
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {ALL_CAMPOS.map(({ key, label }) => {
                    const bloqueado = camposBloqueados.includes(key)
                    return (
                      <label key={key} className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded transition-colors ${bloqueado ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
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
                  {camposBloqueados.length === 0 ? 'Sin restricciones — puede editar todos los campos' : `Bloqueados: ${camposBloqueados.map((k) => ALL_CAMPOS.find((c) => c.key === k)?.label ?? k).join(', ')}`}
                </p>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar permisos'}
                </button>
                {userPermisos.some((p) => p.servicio_id === selectedServicio) && (
                  <button className="btn-danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                    Revocar acceso
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
