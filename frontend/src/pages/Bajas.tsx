import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  UserMinus, Plus, Upload, Search, Trash2, Pencil, X, Check, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { bajasApi, serviciosApi, agentesApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import { useAuthStore } from '../store/auth'
import type { HistoricoBaja, Agente } from '../types'

const TIPOS_FIJOS = [
  'BAJA', 'BAJA LEGAL', 'RENUNCIA', 'CAMBIO DE PUESTO', 'CAMBIO DE CUENTA',
  'CAMBIO DE AREA', 'CAMBIO DE SERVICIO', 'PASE DE SECTOR',
]

const CONTRATOS = ['30 horas', '35 horas', '36 horas']
const MODALIDADES = ['Híbrida', 'Presencial', 'Home Office']

interface BajaForm {
  fecha: string
  dni: string
  nombre: string
  usuario_sistema: string
  superior: string
  jefatura: string
  servicio_id: string
  servicio_nombre: string
  tipo: string
  segmento: string
  horarios: string
  estado: string
  contrato: string
  sitio: string
  modalidad: string
  jefe: string
  observacion: string
}

const emptyForm = (): BajaForm => ({
  fecha: format(new Date(), 'yyyy-MM-dd'),
  dni: '', nombre: '', usuario_sistema: '', superior: '', jefatura: '',
  servicio_id: '', servicio_nombre: '', tipo: '',
  segmento: '', horarios: '', estado: '', contrato: '',
  sitio: '', modalidad: '', jefe: '', observacion: '',
})

export default function Bajas() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const qc = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [filterServicio, setFilterServicio] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<BajaForm>(emptyForm())
  const [showImport, setShowImport] = useState(false)
  const [importServicio, setImportServicio] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Agent search inside form
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
  if (filterTipo) params.tipo = filterTipo
  if (fechaDesde) params.fecha_desde = fechaDesde
  if (fechaHasta) params.fecha_hasta = fechaHasta

  const { data, isLoading } = useQuery({
    queryKey: ['bajas', params],
    queryFn: () => bajasApi.list(params).then((r) => r.data),
  })

  const { data: servicios } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: tipos } = useQuery({
    queryKey: ['bajas-tipos'],
    queryFn: () => bajasApi.tipos().then((r) => r.data),
  })

  // Dynamic options based on selected service in form
  const formServicioId = form.servicio_id ? parseInt(form.servicio_id) : undefined
  const { data: opciones } = useQuery({
    queryKey: ['bajas-opciones', formServicioId],
    queryFn: () => bajasApi.opciones(formServicioId).then((r) => r.data),
    enabled: showForm,
  })

  // Agent search
  const { data: agentResults } = useQuery({
    queryKey: ['agent-search-baja', agentQuery],
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

  const clearAgent = () => {
    setAgentSelected(null)
    setAgentQuery('')
  }

  const createMutation = useMutation({
    mutationFn: (d: Partial<HistoricoBaja>) => bajasApi.create(d),
    onSuccess: () => {
      toast.success('Baja registrada')
      qc.invalidateQueries({ queryKey: ['bajas'] })
      setShowForm(false)
      setForm(emptyForm())
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<HistoricoBaja> }) => bajasApi.update(id, d),
    onSuccess: () => {
      toast.success('Baja actualizada')
      qc.invalidateQueries({ queryKey: ['bajas'] })
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al actualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bajasApi.delete(id),
    onSuccess: () => {
      toast.success('Registro eliminado')
      qc.invalidateQueries({ queryKey: ['bajas'] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const importMutation = useMutation({
    mutationFn: (fd: globalThis.FormData) => bajasApi.import(fd),
    onSuccess: (res) => {
      const r = res.data
      toast.success(`Importado: ${r.created} nuevos, ${r.updated} actualizados, ${r.errors} errores`)
      qc.invalidateQueries({ queryKey: ['bajas'] })
      setShowImport(false)
      setSelectedFile(null)
      setImportServicio('')
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al importar'),
  })

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setAgentSelected(null)
    setAgentQuery('')
    setShowForm(true)
  }

  const openEdit = (b: HistoricoBaja) => {
    setAgentSelected(null)
    setAgentQuery('')
    setEditingId(b.id)
    setForm({
      fecha: b.fecha.substring(0, 10),
      dni: b.dni,
      nombre: b.nombre,
      usuario_sistema: b.usuario_sistema ?? '',
      superior: b.superior ?? '',
      jefatura: b.jefatura ?? '',
      servicio_id: b.servicio_id ? String(b.servicio_id) : '',
      servicio_nombre: b.servicio_nombre ?? '',
      tipo: b.tipo ?? '',
      segmento: b.segmento ?? '',
      horarios: b.horarios ?? '',
      estado: b.estado ?? '',
      contrato: b.contrato ?? '',
      sitio: b.sitio ?? '',
      modalidad: b.modalidad ?? '',
      jefe: b.jefe ?? '',
      observacion: b.observacion ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Partial<HistoricoBaja> = {
      fecha: form.fecha,
      dni: form.dni.trim(),
      nombre: form.nombre.trim(),
      usuario_sistema: form.usuario_sistema || undefined,
      superior: form.superior || undefined,
      jefatura: form.jefatura || undefined,
      servicio_id: form.servicio_id ? parseInt(form.servicio_id) : undefined,
      servicio_nombre: form.servicio_nombre || undefined,
      tipo: form.tipo || undefined,
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

  const handleImport = () => {
    if (!selectedFile || !importServicio) return
    const fd = new globalThis.FormData()
    fd.append('file', selectedFile)
    fd.append('servicio_id', importServicio)
    importMutation.mutate(fd)
  }

  const allTipos = Array.from(new Set([...TIPOS_FIJOS, ...(tipos ?? [])]))
  const totalPages = Math.ceil((data?.total ?? 0) / 50)

  const tipoColor = (tipo: string | null) => {
    if (!tipo) return 'bg-gray-100 text-gray-600'
    const t = tipo.toUpperCase()
    if (t.includes('BAJA') || t.includes('RENUNCIA')) return 'bg-red-100 text-red-700'
    if (t.includes('CAMBIO') || t.includes('PASE') || t.includes('SECTOR')) return 'bg-blue-100 text-blue-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Historial de Bajas"
        subtitle="Registro de agentes dados de baja o con cambio de puesto/cuenta"
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
            value={filterTipo}
            onChange={(e) => { setFilterTipo(e.target.value); setPage(1) }}
          >
            <option value="">Todos los tipos</option>
            {allTipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <input
            type="date"
            className="input-base"
            value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setPage(1) }}
            placeholder="Desde"
          />
          <input
            type="date"
            className="input-base"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPage(1) }}
            placeholder="Hasta"
          />

          <div className="flex gap-2 ml-auto">
            {isAdmin && (
              <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImport(true)}>
                <Upload size={14} /> Importar Excel
              </button>
            )}
            <button className="btn-primary flex items-center gap-2" onClick={openNew}>
              <Plus size={14} /> Registrar baja
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <PageLoading text="Cargando bajas..." />
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Área</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contrato</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Modalidad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registrado por</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-gray-400 text-sm">
                          No hay registros de bajas
                        </td>
                      </tr>
                    )}
                    {data?.data.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {format(new Date(b.fecha), 'dd/MM/yyyy', { locale: es })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.dni}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{b.nombre}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.superior ?? '—'}</td>
                        <td className="px-4 py-3">
                          {b.servicio ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: b.servicio.color }}
                              />
                              <span className="text-xs text-gray-700">{b.servicio.nombre}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{b.servicio_nombre ?? '—'}</td>
                        <td className="px-4 py-3">
                          {b.tipo ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tipoColor(b.tipo)}`}>
                              {b.tipo}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{b.contrato ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{b.modalidad ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{b.creador?.nombre ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(b)}
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar la baja de ${b.nombre}?`)) {
                                    deleteMutation.mutate(b.id)
                                  }
                                }}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  {data?.total} registros · Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary py-1 px-3 flex items-center gap-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    className="btn-secondary py-1 px-3 flex items-center gap-1"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
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
                <UserMinus size={18} className="text-red-500" />
                <h3 className="text-base font-bold text-gray-900">
                  {editingId ? 'Editar baja' : 'Registrar baja'}
                </h3>
              </div>
                      <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); setAgentSelected(null); setAgentQuery('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Agent search — only on create */}
              {!editingId && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-blue-700 mb-2">
                    Buscar agente en el sistema
                  </label>
                  {agentSelected ? (
                    <div className="flex items-center justify-between bg-white border border-blue-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{agentSelected.nombre}</p>
                        <p className="text-xs text-gray-500">DNI {agentSelected.dni} · {agentSelected.usuario}</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearAgent}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-3"
                        title="Limpiar selección"
                      >
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
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => selectAgent(a)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                                  <p className="text-xs text-gray-500">
                                    DNI {a.dni} · {a.servicio?.nombre ?? 'Sin servicio'}
                                  </p>
                                </div>
                                {!a.activo && (
                                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                    Inactivo
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-blue-500 mt-1.5">
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="input-base w-full"
                    value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="">— Seleccionar —</option>
                    {allTipos.map((t) => <option key={t} value={t}>{t}</option>)}
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
                  <input className="input-base w-full" placeholder="Ej: jperez"
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
                  <select className="input-base w-full"
                    value={form.servicio_id}
                    onChange={(e) => setForm({ ...form, servicio_id: e.target.value, segmento: '', estado: '', sitio: '', superior: '', jefe: '' })}>
                    <option value="">— Sin asignar —</option>
                    {servicios?.filter((s) => s.activo).map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Área / Sub-servicio</label>
                  <input className="input-base w-full" placeholder="Ej: SOPORTE-HFC"
                    value={form.servicio_nombre} onChange={(e) => setForm({ ...form, servicio_nombre: e.target.value })} />
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jefatura</label>
                  <input className="input-base w-full"
                    value={form.jefatura} onChange={(e) => setForm({ ...form, jefatura: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Horarios</label>
                  <input className="input-base w-full" placeholder="Ej: 08:00"
                    value={form.horarios} onChange={(e) => setForm({ ...form, horarios: e.target.value })} />
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
                <button type="button" className="btn-secondary"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); setAgentSelected(null); setAgentQuery('') }}>
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

      {/* Import Modal */}
      {showImport && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-konecta" />
                <h3 className="text-base font-bold text-gray-900">Importar Excel de bajas</h3>
              </div>
              <button onClick={() => { setShowImport(false); setSelectedFile(null); setImportServicio('') }}
                className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Servicio / Área *</label>
                <select className="input-base w-full" value={importServicio}
                  onChange={(e) => setImportServicio(e.target.value)}>
                  <option value="">— Seleccionar servicio —</option>
                  {servicios?.filter((s) => s.activo).map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Archivo Excel *</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-konecta transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Clic para seleccionar archivo .xlsx</p>
                      <p className="text-xs text-gray-400 mt-1">Formato: Histórico de Bajas</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                El archivo debe tener el formato del Histórico de Bajas de Konecta.<br />
                Los registros existentes (mismo DNI + servicio) se actualizarán automáticamente.
              </p>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => { setShowImport(false); setSelectedFile(null); setImportServicio('') }}>
                  Cancelar
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={!selectedFile || !importServicio || importMutation.isPending}
                  onClick={handleImport}
                >
                  <Upload size={14} /> {importMutation.isPending ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
