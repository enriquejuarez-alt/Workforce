import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, X, FilePen } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'
import { cambiosContratoApi, agentesApi, serviciosApi } from '../lib/api'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { CambioContrato, Agente } from '../types'

const CONTRATOS = ['30', '35', '36'] as const

interface CambioContratoForm {
  agente_id: string
  agente_nombre: string
  agente_dni: string
  contrato_anterior: string
  tipo: 'TEMPORAL' | 'DEFINITIVO'
  contrato_nuevo: string
  fecha_desde: string
  fecha_hasta: string
  motivo: string
  observacion: string
}

const FORM_EMPTY: CambioContratoForm = {
  agente_id: '',
  agente_nombre: '',
  agente_dni: '',
  contrato_anterior: '',
  tipo: 'DEFINITIVO',
  contrato_nuevo: '',
  fecha_desde: '',
  fecha_hasta: '',
  motivo: '',
  observacion: '',
}

function formatDate(iso: string) {
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function estadoClass(estado?: string) {
  if (estado === 'VIGENTE') return 'bg-green-100 text-green-800'
  if (estado === 'PENDIENTE') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-600'
}

export default function CambiosContrato() {
  const { user } = useAuthStore()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const qc = useQueryClient()

  const [filterServicio, setFilterServicio] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterContrato, setFilterContrato] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<CambioContratoForm>(FORM_EMPTY)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; nombre: string } | null>(null)

  const [agentQuery, setAgentQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [dniInput, setDniInput] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: cambios = [], isLoading } = useQuery({
    queryKey: ['cambios-contrato', filterServicio, filterTipo, filterContrato],
    queryFn: () =>
      cambiosContratoApi
        .list({
          ...(filterServicio && { servicio_id: parseInt(filterServicio) }),
          ...(filterTipo && { tipo: filterTipo }),
          ...(filterContrato && { contrato_nuevo: filterContrato }),
        })
        .then((r) => r.data),
  })

  const { data: agentResults = [] } = useQuery({
    queryKey: ['agentes-search-contrato', agentQuery],
    queryFn: () => agentesApi.list({ search: agentQuery }).then((r) => r.data),
    enabled: agentQuery.length >= 2,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => cambiosContratoApi.create(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cambios-contrato'] })
      toast.success('Cambio de contrato registrado')
      closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear'),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => cambiosContratoApi.bulk(data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cambios-contrato'] })
      if (data.creados.length > 0) {
        toast.success(`${data.creados.length} cambio${data.creados.length > 1 ? 's' : ''} registrado${data.creados.length > 1 ? 's' : ''}`)
      }
      if (data.no_encontrados.length > 0) {
        toast.error(`DNI no encontrados: ${data.no_encontrados.join(', ')}`)
      }
      if (data.creados.length > 0) closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear en lote'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      cambiosContratoApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cambios-contrato'] })
      toast.success('Cambio actualizado')
      closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al actualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cambiosContratoApi.delete(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cambios-contrato'] })
      toast.success('Cambio eliminado')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  })

  function selectAgent(a: Agente) {
    setForm((prev) => ({
      ...prev,
      agente_id: String(a.id),
      agente_nombre: a.nombre,
      agente_dni: a.dni,
      contrato_anterior: a.contrato || '',
    }))
    setAgentQuery(a.nombre)
    setShowResults(false)
  }

  function clearAgent() {
    setForm((prev) => ({ ...prev, agente_id: '', agente_nombre: '', agente_dni: '', contrato_anterior: '' }))
    setAgentQuery('')
  }

  function openEdit(c: CambioContrato) {
    setEditId(c.id)
    setForm({
      agente_id: String(c.agente_id),
      agente_nombre: c.agente_nombre,
      agente_dni: c.agente_dni,
      contrato_anterior: c.contrato_anterior || '',
      tipo: c.tipo,
      contrato_nuevo: c.contrato_nuevo,
      fecha_desde: c.fecha_desde.split('T')[0],
      fecha_hasta: c.fecha_hasta ? c.fecha_hasta.split('T')[0] : '',
      motivo: c.motivo || '',
      observacion: c.observacion || '',
    })
    setAgentQuery(c.agente_nombre)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(FORM_EMPTY)
    setAgentQuery('')
    setBulkMode(false)
    setDniInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (bulkMode) {
      const dnis = dniInput.split(/[,\n]+/).map((d) => d.trim()).filter(Boolean)
      bulkCreateMutation.mutate({
        agente_dnis: dnis,
        tipo: form.tipo,
        contrato_nuevo: form.contrato_nuevo,
        fecha_desde: form.fecha_desde,
        fecha_hasta: form.tipo === 'TEMPORAL' ? form.fecha_hasta || null : null,
        motivo: form.motivo || null,
        observacion: form.observacion || null,
      })
      return
    }
    const payload = {
      agente_id: parseInt(form.agente_id),
      tipo: form.tipo,
      contrato_nuevo: form.contrato_nuevo,
      fecha_desde: form.fecha_desde,
      fecha_hasta: form.tipo === 'TEMPORAL' ? form.fecha_hasta || null : null,
      motivo: form.motivo || null,
      observacion: form.observacion || null,
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const parsedDnis = bulkMode
    ? dniInput.split(/[,\n]+/).map((d) => d.trim()).filter(Boolean)
    : []

  const isBusy = createMutation.isPending || updateMutation.isPending || bulkCreateMutation.isPending
  const canSubmit = bulkMode
    ? parsedDnis.length > 0 && !!form.contrato_nuevo && !!form.fecha_desde && (form.tipo === 'DEFINITIVO' || !!form.fecha_hasta)
    : !!form.agente_id && !!form.contrato_nuevo && !!form.fecha_desde && (form.tipo === 'DEFINITIVO' || !!form.fecha_hasta)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cambios de Contrato</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de cambios de jornada laboral (30, 35, 36 hs)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo cambio
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filterServicio}
          onChange={(e) => setFilterServicio(e.target.value)}
          className="input-field text-sm h-9 min-w-[180px]"
        >
          <option value="">Todos los servicios</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="input-field text-sm h-9"
        >
          <option value="">Todos los tipos</option>
          <option value="DEFINITIVO">Definitivo</option>
          <option value="TEMPORAL">Temporal</option>
        </select>

        <select
          value={filterContrato}
          onChange={(e) => setFilterContrato(e.target.value)}
          className="input-field text-sm h-9"
        >
          <option value="">Todas las jornadas</option>
          {CONTRATOS.map((c) => (
            <option key={c} value={c}>{c} hs</option>
          ))}
        </select>

        {(filterServicio || filterTipo || filterContrato) && (
          <button
            onClick={() => { setFilterServicio(''); setFilterTipo(''); setFilterContrato('') }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X size={14} /> Limpiar
          </button>
        )}

        <span className="ml-auto text-sm text-gray-400">{cambios.length} registros</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>
        ) : cambios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FilePen size={40} className="mb-2 opacity-30" />
            <p className="text-sm">No hay cambios de contrato registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th">Cambio</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th w-16"></th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-td">
                      <p className="font-medium text-gray-900 text-sm">{c.agente_nombre}</p>
                      <p className="text-xs text-gray-400">{c.agente_dni}</p>
                    </td>
                    <td className="table-td">
                      {c.servicio ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.servicio.color }} />
                          {c.servicio.nombre}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td">
                      <span className={`badge text-xs ${c.tipo === 'TEMPORAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {c.tipo === 'TEMPORAL' ? 'Temporal' : 'Definitivo'}
                      </span>
                    </td>
                    <td className="table-td">
                      <span className="text-sm text-gray-400">{c.contrato_anterior ?? '?'} hs</span>
                      <span className="mx-1.5 text-gray-300">→</span>
                      <span className="text-sm font-semibold text-gray-900">{c.contrato_nuevo} hs</span>
                    </td>
                    <td className="table-td text-sm text-gray-600">{formatDate(c.fecha_desde)}</td>
                    <td className="table-td text-sm text-gray-500">
                      {c.fecha_hasta ? formatDate(c.fecha_hasta) : <span className="text-gray-400 italic">Permanente</span>}
                    </td>
                    <td className="table-td">
                      <span className={`badge text-xs ${estadoClass(c.estado_calculado)}`}>
                        {c.estado_calculado ?? '—'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setPendingDelete({ id: c.id, nombre: c.agente_nombre })}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editId ? 'Editar cambio de contrato' : 'Nuevo cambio de contrato'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Agent search / bulk toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">{bulkMode ? 'DNIs' : 'Agente'}</label>
                  {!editId && (
                    <button
                      type="button"
                      onClick={() => { setBulkMode((v) => !v); setDniInput(''); clearAgent() }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {bulkMode ? 'Buscar por nombre' : 'Agregar varios DNI'}
                    </button>
                  )}
                </div>

                {bulkMode ? (
                  <div>
                    <textarea
                      value={dniInput}
                      onChange={(e) => setDniInput(e.target.value)}
                      placeholder={'Ej: 39882976,44567876,55123456\n(separados por coma o salto de línea)'}
                      rows={3}
                      className="input-field text-sm resize-none font-mono"
                      autoFocus
                    />
                    {parsedDnis.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{parsedDnis.length} DNI{parsedDnis.length > 1 ? 's' : ''} ingresado{parsedDnis.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                ) : (
                  <div ref={searchRef} className="relative">
                    {form.agente_id ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-blue-900">{form.agente_nombre}</p>
                          <p className="text-xs text-blue-600">
                            DNI: {form.agente_dni}
                            {form.contrato_anterior && ` · Contrato actual: ${form.contrato_anterior} hs`}
                          </p>
                        </div>
                        {!editId && (
                          <button type="button" onClick={clearAgent} className="text-blue-400 hover:text-blue-600 p-1">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={agentQuery}
                            onChange={(e) => { setAgentQuery(e.target.value); setShowResults(true) }}
                            onFocus={() => agentQuery.length >= 2 && setShowResults(true)}
                            placeholder="Buscar por nombre o DNI..."
                            className="input-field pl-9 text-sm"
                            autoFocus
                          />
                        </div>
                        {showResults && agentQuery.length >= 2 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {agentResults.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                            ) : (
                              agentResults.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => selectAgent(a)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                >
                                  <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                                  <p className="text-xs text-gray-500">
                                    DNI: {a.dni}
                                    {a.contrato ? ` · ${a.contrato} hs` : ''}
                                    {a.servicio ? ` · ${a.servicio.nombre}` : ''}
                                  </p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div>
                <label className="form-label">Tipo de cambio</label>
                <div className="flex gap-3">
                  {(['DEFINITIVO', 'TEMPORAL'] as const).map((t) => (
                    <label
                      key={t}
                      className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                        form.tipo === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        value={t}
                        checked={form.tipo === t}
                        onChange={() => setForm((prev) => ({ ...prev, tipo: t, fecha_hasta: '' }))}
                      />
                      {t === 'DEFINITIVO' ? 'Definitivo' : 'Temporal'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Contrato nuevo */}
              <div>
                <label className="form-label">Jornada nueva</label>
                <div className="flex gap-3">
                  {CONTRATOS.map((c) => (
                    <label
                      key={c}
                      className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-semibold transition-all ${
                        form.contrato_nuevo === c
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        value={c}
                        checked={form.contrato_nuevo === c}
                        onChange={() => setForm((prev) => ({ ...prev, contrato_nuevo: c }))}
                      />
                      {c} hs
                    </label>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className={`grid gap-3 ${form.tipo === 'TEMPORAL' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="form-label">Fecha desde</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_desde}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_desde: e.target.value }))}
                    className="input-field text-sm"
                  />
                </div>
                {form.tipo === 'TEMPORAL' && (
                  <div>
                    <label className="form-label">Fecha hasta</label>
                    <input
                      type="date"
                      required
                      value={form.fecha_hasta}
                      min={form.fecha_desde}
                      onChange={(e) => setForm((prev) => ({ ...prev, fecha_hasta: e.target.value }))}
                      className="input-field text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Motivo */}
              <div>
                <label className="form-label">
                  Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: Reducción de horas por acuerdo"
                  className="input-field text-sm"
                />
              </div>

              {/* Observacion */}
              <div>
                <label className="form-label">
                  Observación <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={form.observacion}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacion: e.target.value }))}
                  rows={2}
                  className="input-field text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isBusy || !canSubmit}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {isBusy
                  ? 'Guardando...'
                  : editId
                    ? 'Guardar cambios'
                    : bulkMode && parsedDnis.length > 0
                      ? `Registrar para ${parsedDnis.length} agente${parsedDnis.length > 1 ? 's' : ''}`
                      : 'Registrar'}
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
        title="Eliminar cambio de contrato"
        message={`¿Eliminar el cambio de contrato de ${pendingDelete?.nombre}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </div>
  )
}
