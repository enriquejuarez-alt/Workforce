import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  UserX, Plus, Search, Trash2, Pencil, X, Check, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { remocionesApi, serviciosApi, agentesApi, bajasApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuthStore } from '../store/auth'
import type { Remocion, Agente } from '../types'

const MOTIVOS = [
  { value: 'BAJA_PERFORMANCE', label: 'Baja Performance' },
  { value: 'ALERTA_MATCH', label: 'Alerta Match' },
  { value: 'REMOCION_CLIENTE', label: 'Remoción por Cliente' },
  { value: 'OTRO', label: 'Otro' },
]

const CONTRATOS = ['30 horas', '35 horas', '36 horas']
const MODALIDADES = ['Híbrida', 'Presencial', 'Home Office']

interface RemocionForm {
  fecha: string
  dni: string
  nombre: string
  usuario_sistema: string
  superior: string
  jefatura: string
  servicio_id: string
  servicio_nombre: string
  motivo: string
  segmento: string
  horarios: string
  estado: string
  contrato: string
  sitio: string
  modalidad: string
  jefe: string
  observacion: string
}

const emptyForm = (): RemocionForm => ({
  fecha: format(new Date(), 'yyyy-MM-dd'),
  dni: '', nombre: '', usuario_sistema: '', superior: '', jefatura: '',
  servicio_id: '', servicio_nombre: '', motivo: '',
  segmento: '', horarios: '', estado: '', contrato: '',
  sitio: '', modalidad: '', jefe: '', observacion: '',
})

const motivoColor = (motivo: string | null) => {
  if (!motivo) return 'bg-gray-100 text-gray-600'
  if (motivo === 'BAJA_PERFORMANCE') return 'bg-red-100 text-red-700'
  if (motivo === 'ALERTA_MATCH') return 'bg-orange-100 text-orange-700'
  if (motivo === 'REMOCION_CLIENTE') return 'bg-purple-100 text-purple-700'
  return 'bg-gray-100 text-gray-600'
}

const motivoLabel = (motivo: string | null) =>
  MOTIVOS.find((m) => m.value === motivo)?.label ?? motivo ?? '—'

export default function Remociones() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterServicio, setFilterServicio] = useState('')
  const [filterMotivo, setFilterMotivo] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RemocionForm>(emptyForm())
  const [pendingDelete, setPendingDelete] = useState<{ id: number; nombre: string } | null>(null)

  const [agentQuery, setAgentQuery] = useState('')
  const [agentSelected, setAgentSelected] = useState<Agente | null>(null)
  const [showAgentResults, setShowAgentResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAgentResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const params: Record<string, any> = { page, limit: 50 }
  if (search) params.search = search
  if (filterServicio) params.servicio_id = filterServicio
  if (filterMotivo) params.motivo = filterMotivo
  if (fechaDesde) params.fecha_desde = fechaDesde
  if (fechaHasta) params.fecha_hasta = fechaHasta

  const { data, isLoading } = useQuery({
    queryKey: ['remociones', params],
    queryFn: () => remocionesApi.list(params).then((r) => r.data),
  })

  const { data: servicios } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const formServicioId = form.servicio_id ? parseInt(form.servicio_id) : undefined
  const { data: opciones } = useQuery({
    queryKey: ['bajas-opciones', formServicioId],
    queryFn: () => bajasApi.opciones(formServicioId).then((r) => r.data),
    enabled: showForm,
  })

  const { data: agentResults } = useQuery({
    queryKey: ['agent-search-rem', agentQuery],
    queryFn: () => agentesApi.list({ search: agentQuery }).then((r) => r.data.slice(0, 8)),
    enabled: agentQuery.length >= 2,
    staleTime: 10_000,
  })

  const selectAgent = (a: Agente) => {
    setAgentSelected(a)
    setShowAgentResults(false)
    setAgentQuery('')
    setForm((prev) => ({
      ...prev,
      dni: a.dni,
      nombre: a.nombre,
      usuario_sistema: a.usuario ?? '',
      superior: a.superior ?? '',
      segmento: a.segmento ?? '',
      horarios: a.horarios ?? '',
      estado: a.estado ?? '',
      contrato: a.contrato ?? '',
      sitio: a.sitio ?? '',
      modalidad: a.modalidad ?? '',
      jefe: a.jefe ?? '',
      servicio_id: a.servicio_id ? String(a.servicio_id) : prev.servicio_id,
    }))
  }

  const createMutation = useMutation({
    mutationFn: (d: Partial<Remocion>) => remocionesApi.create(d),
    onSuccess: () => {
      toast.success('Remoción registrada')
      qc.invalidateQueries({ queryKey: ['remociones'] })
      closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<Remocion> }) => remocionesApi.update(id, d),
    onSuccess: () => {
      toast.success('Remoción actualizada')
      qc.invalidateQueries({ queryKey: ['remociones'] })
      closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al actualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => remocionesApi.delete(id),
    onSuccess: () => {
      toast.success('Registro eliminado')
      qc.invalidateQueries({ queryKey: ['remociones'] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setAgentSelected(null)
    setAgentQuery('')
    setShowForm(true)
  }

  const openEdit = (r: Remocion) => {
    setAgentSelected(null)
    setAgentQuery('')
    setEditingId(r.id)
    setForm({
      fecha: r.fecha.substring(0, 10),
      dni: r.dni,
      nombre: r.nombre,
      usuario_sistema: r.usuario_sistema ?? '',
      superior: r.superior ?? '',
      jefatura: r.jefatura ?? '',
      servicio_id: r.servicio_id ? String(r.servicio_id) : '',
      servicio_nombre: r.servicio_nombre ?? '',
      motivo: r.motivo ?? '',
      segmento: r.segmento ?? '',
      horarios: r.horarios ?? '',
      estado: r.estado ?? '',
      contrato: r.contrato ?? '',
      sitio: r.sitio ?? '',
      modalidad: r.modalidad ?? '',
      jefe: r.jefe ?? '',
      observacion: r.observacion ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    setAgentSelected(null)
    setAgentQuery('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Partial<Remocion> = {
      fecha: form.fecha,
      dni: form.dni.trim(),
      nombre: form.nombre.trim(),
      usuario_sistema: form.usuario_sistema || undefined,
      superior: form.superior || undefined,
      jefatura: form.jefatura || undefined,
      servicio_id: form.servicio_id ? parseInt(form.servicio_id) : undefined,
      servicio_nombre: form.servicio_nombre || undefined,
      motivo: form.motivo || undefined,
      segmento: form.segmento || undefined,
      horarios: form.horarios || undefined,
      estado: form.estado || undefined,
      contrato: form.contrato || undefined,
      sitio: form.sitio || undefined,
      modalidad: form.modalidad || undefined,
      jefe: form.jefe || undefined,
      observacion: form.observacion || undefined,
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, d: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const totalPages = Math.ceil((data?.total ?? 0) / 50)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Remociones"
        subtitle="Agentes removidos por el cliente que siguen activos en la empresa"
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-base pl-9 w-full"
              placeholder="Buscar por nombre o DNI..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          <select
            className="input-base"
            value={filterServicio}
            onChange={(e) => { setFilterServicio(e.target.value); setPage(1) }}
          >
            <option value="">Todos los servicios</option>
            {servicios?.filter((s) => s.activo).map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          <select
            className="input-base"
            value={filterMotivo}
            onChange={(e) => { setFilterMotivo(e.target.value); setPage(1) }}
          >
            <option value="">Todos los motivos</option>
            {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <input type="date" className="input-base" value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setPage(1) }} />
          <input type="date" className="input-base" value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPage(1) }} />

          <button className="btn-primary flex items-center gap-2 ml-auto" onClick={openNew}>
            <Plus size={14} /> Registrar remoción
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <PageLoading text="Cargando remociones..." />
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">DNI</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Superior</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Servicio</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contrato</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Modalidad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registrado por</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                          No hay registros de remociones
                        </td>
                      </tr>
                    )}
                    {data?.data.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {format(new Date(r.fecha), 'dd/MM/yyyy', { locale: es })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.dni}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{r.superior ?? '—'}</td>
                        <td className="px-4 py-3">
                          {r.servicio ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.servicio.color }} />
                              <span className="text-xs text-gray-700">{r.servicio.nombre}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.motivo ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${motivoColor(r.motivo)}`}>
                              {motivoLabel(r.motivo)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{r.contrato ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{r.modalidad ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.creador?.nombre ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                              <Pencil size={13} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setPendingDelete({ id: r.id, nombre: r.nombre })}
                                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  {data?.total} registros · Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button className="btn-secondary py-1 px-3 flex items-center gap-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button className="btn-secondary py-1 px-3 flex items-center gap-1"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <UserX size={18} className="text-purple-500" />
                <h3 className="text-base font-bold text-gray-900">
                  {editingId ? 'Editar remoción' : 'Registrar remoción'}
                </h3>
              </div>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Agent search — only on create */}
              {!editingId && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-purple-700 mb-2">
                    Buscar agente en el sistema
                  </label>
                  {agentSelected ? (
                    <div className="flex items-center justify-between bg-white border border-purple-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{agentSelected.nombre}</p>
                        <p className="text-xs text-gray-500">DNI {agentSelected.dni} · {agentSelected.usuario}</p>
                      </div>
                      <button type="button" onClick={() => { setAgentSelected(null); setAgentQuery('') }}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-3" title="Limpiar">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div ref={searchRef} className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input-base w-full pl-8"
                        placeholder="Nombre o DNI del agente..."
                        value={agentQuery}
                        onChange={(e) => { setAgentQuery(e.target.value); setShowAgentResults(true) }}
                        onFocus={() => agentQuery.length >= 2 && setShowAgentResults(true)}
                        autoComplete="off"
                      />
                      {showAgentResults && agentQuery.length >= 2 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {!agentResults || agentResults.length === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-3 text-center">Sin resultados</p>
                          ) : agentResults.map((a) => (
                            <button key={a.id} type="button" onClick={() => selectAgent(a)}
                              className="w-full text-left px-3 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0">
                              <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                              <p className="text-xs text-gray-500">DNI {a.dni} · {a.servicio?.nombre ?? 'Sin servicio'}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-purple-500 mt-1.5">
                    Al seleccionar un agente se completan los datos automáticamente
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
                  <input type="date" required className="input-base w-full"
                    value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
                  <select className="input-base w-full"
                    value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                    <option value="">— Seleccionar —</option>
                    {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">DNI *</label>
                  <input required className="input-base w-full" placeholder="Ej: 30123456"
                    value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Usuario sistema</label>
                  <input className="input-base w-full"
                    value={form.usuario_sistema} onChange={(e) => setForm({ ...form, usuario_sistema: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input required className="input-base w-full" placeholder="Apellido Nombre"
                  value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Servicio</label>
                  <select className="input-base w-full" value={form.servicio_id}
                    onChange={(e) => setForm({ ...form, servicio_id: e.target.value, segmento: '', estado: '', sitio: '', superior: '', jefe: '' })}>
                    <option value="">— Sin asignar —</option>
                    {servicios?.filter((s) => s.activo).map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jefatura</label>
                  <input className="input-base w-full"
                    value={form.jefatura} onChange={(e) => setForm({ ...form, jefatura: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Superior / Líder</label>
                  {opciones?.superiores?.length ? (
                    <select className="input-base w-full"
                      value={form.superior} onChange={(e) => setForm({ ...form, superior: e.target.value })}>
                      <option value="">— Sin superior —</option>
                      {opciones.superiores.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input-base w-full"
                      value={form.superior} onChange={(e) => setForm({ ...form, superior: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Segmento</label>
                  {opciones?.segmentos?.length ? (
                    <select className="input-base w-full"
                      value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
                      <option value="">—</option>
                      {opciones.segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input-base w-full"
                      value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                  {opciones?.estados?.length ? (
                    <select className="input-base w-full"
                      value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                      <option value="">—</option>
                      {opciones.estados.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input-base w-full"
                      value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sitio</label>
                  {opciones?.sitios?.length ? (
                    <select className="input-base w-full"
                      value={form.sitio} onChange={(e) => setForm({ ...form, sitio: e.target.value })}>
                      <option value="">—</option>
                      {opciones.sitios.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input-base w-full"
                      value={form.sitio} onChange={(e) => setForm({ ...form, sitio: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Horarios</label>
                  <input className="input-base w-full" placeholder="Ej: 08:00"
                    value={form.horarios} onChange={(e) => setForm({ ...form, horarios: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contrato</label>
                  <select className="input-base w-full"
                    value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })}>
                    <option value="">—</option>
                    {CONTRATOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Modalidad</label>
                  <select className="input-base w-full"
                    value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}>
                    <option value="">—</option>
                    {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jefe</label>
                {opciones?.jefes?.length ? (
                  <select className="input-base w-full"
                    value={form.jefe} onChange={(e) => setForm({ ...form, jefe: e.target.value })}>
                    <option value="">—</option>
                    {opciones.jefes.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                ) : (
                  <input className="input-base w-full"
                    value={form.jefe} onChange={(e) => setForm({ ...form, jefe: e.target.value })} />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observación</label>
                <textarea rows={2} className="input-base w-full resize-none"
                  value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  <Check size={14} /> {editingId ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) deleteMutation.mutate(pendingDelete.id); setPendingDelete(null) }}
        title="Eliminar remoción"
        message={`¿Eliminar la remoción de ${pendingDelete?.nombre}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
