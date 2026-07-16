"use client";

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeftRight, FilePen, Clock, Search, Pencil, X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Header from '@/components/hr/layout/Header'
import Badge, { CambioTemporalBadge } from '@/components/hr/ui/Badge'
import ConfirmDialog from '@/components/hr/ui/ConfirmDialog'
import { cambiosApi, cambiosContratoApi, cambiosHorarioApi, agentesApi, serviciosApi } from '@/lib/api'
import { PageLoading } from '@/components/hr/ui/LoadingSpinner'
import { useAuthStore } from '@/store/auth'
import type { Agente, CambioContrato, CambioHorario } from '@/types'

type Tab = 'servicio' | 'contrato' | 'horario'

const TABS: { id: Tab; label: string; icon: typeof ArrowLeftRight }[] = [
  { id: 'servicio', label: 'Cambio de Servicio', icon: ArrowLeftRight },
  { id: 'contrato', label: 'Cambio de Contrato', icon: FilePen },
  { id: 'horario', label: 'Cambio de Horario', icon: Clock },
]

const CONTRATOS = ['30', '35', '36'] as const

function estadoBadge(estado?: string) {
  if (estado === 'VIGENTE') return 'bg-green-100 text-green-800'
  if (estado === 'PENDIENTE') return 'bg-yellow-100 text-yellow-800'
  if (estado === 'FINALIZADO') return 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-600'
}

function formatDate(iso: string) {
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

// ─── Agent search hook helper ────────────────────────────────────────────────
function useAgentSearch() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Agente | null>(null)
  const [showResults, setShowResults] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: results = [] } = useQuery({
    queryKey: ['agent-search-cambios', query],
    queryFn: () => agentesApi.list({ search: query }).then((r) => r.data.data.slice(0, 8)),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })

  function select(a: Agente) {
    setSelected(a)
    setQuery(a.nombre)
    setShowResults(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
  }

  return { query, setQuery, selected, showResults, setShowResults, results, ref, select, clear }
}

// ─── Tab Servicio ─────────────────────────────────────────────────────────────
function TabServicio({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [activoFilter, setActivoFilter] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: cambios = [], isLoading } = useQuery({
    queryKey: ['cambios', activoFilter],
    queryFn: () => cambiosApi.list({ activo: activoFilter ? 'true' : undefined }).then((r) => r.data),
  })

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes-activos'],
    queryFn: () => agentesApi.list({ activo: 'true', limit: 1000 }).then((r) => r.data.data),
    enabled: showCreate,
  })

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
    enabled: showCreate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cambiosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios'] }); toast.success('Eliminado'); setDeleteId(null) },
    onError: () => toast.error('Error al eliminar'),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => cambiosApi.create({
      ...data,
      agente_id: parseInt(data.agente_id),
      servicio_temporal_id: parseInt(data.servicio_temporal_id),
    }),
    onSuccess: () => {
      toast.success('Cambio de servicio registrado')
      qc.invalidateQueries({ queryKey: ['cambios'] })
      setShowCreate(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({ agente_id: '', servicio_temporal_id: '', fecha_desde: today, fecha_hasta: today, motivo: '', observacion: '' })

  if (isLoading) return <PageLoading />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" className="rounded accent-konecta" checked={activoFilter}
            onChange={(e) => setActivoFilter(e.target.checked)} />
          Solo cambios activos
        </label>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Nuevo cambio de servicio
        </button>
      </div>

      {cambios.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <ArrowLeftRight size={40} className="mb-2 opacity-30" />
          <p className="text-sm">No hay cambios de servicio registrados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio original</th>
                  <th className="table-th">Servicio temporal</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Motivo</th>
                  {isAdmin && <th className="table-th" />}
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td">
                      <p className="font-semibold text-gray-800 text-sm">{c.agente?.nombre}</p>
                      <p className="text-xs text-gray-400">{c.agente?.usuario}</p>
                    </td>
                    <td className="table-td text-xs">{c.agente?.servicio?.nombre || `ID ${c.servicio_original_id}`}</td>
                    <td className="table-td text-xs">{c.servicio_temporal?.nombre || '—'}</td>
                    <td className="table-td text-xs">{format(new Date(c.fecha_desde), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td text-xs">{format(new Date(c.fecha_hasta), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td">
                      {c.activo ? <CambioTemporalBadge /> : <Badge variant="gray">Finalizado</Badge>}
                    </td>
                    <td className="table-td text-xs text-gray-500">{c.motivo || '—'}</td>
                    {isAdmin && (
                      <td className="table-td">
                        <button className="btn-ghost py-1 px-2 text-red-500" onClick={() => setDeleteId(c.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo cambio de servicio</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label-base">Agente *</label>
                <select value={form.agente_id} onChange={(e) => setForm({ ...form, agente_id: e.target.value })} className="input-base">
                  <option value="">Seleccionar agente...</option>
                  {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre} — {a.servicio?.nombre || 'Sin servicio'}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">Servicio temporal *</label>
                <select value={form.servicio_temporal_id} onChange={(e) => setForm({ ...form, servicio_temporal_id: e.target.value })} className="input-base">
                  <option value="">Seleccionar servicio...</option>
                  {servicios.filter((s: any) => s.activo).map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">Fecha desde *</label>
                  <input type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} className="input-base" />
                </div>
                <div>
                  <label className="label-base">Fecha hasta *</label>
                  <input type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} className="input-base" />
                </div>
              </div>
              <div>
                <label className="label-base">Motivo</label>
                <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="label-base">Observaciones</label>
                <textarea value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} rows={2} className="input-base resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={createMutation.isPending || !form.agente_id || !form.servicio_temporal_id}
                  onClick={() => createMutation.mutate(form)}
                >
                  <Check size={14} /> {createMutation.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Eliminar cambio de servicio"
        message="¿Seguro querés eliminar este cambio?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─── Tab Contrato ─────────────────────────────────────────────────────────────
function TabContrato({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [filterTipo, setFilterTipo] = useState('')
  const [filterContrato, setFilterContrato] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; nombre: string } | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [dniInput, setDniInput] = useState('')

  interface ContratoForm {
    agente_id: string; agente_nombre: string; agente_dni: string; contrato_anterior: string
    tipo: 'TEMPORAL' | 'DEFINITIVO'; contrato_nuevo: string
    fecha_desde: string; fecha_hasta: string; motivo: string; observacion: string
  }
  const EMPTY_CONTRATO: ContratoForm = {
    agente_id: '', agente_nombre: '', agente_dni: '', contrato_anterior: '',
    tipo: 'DEFINITIVO', contrato_nuevo: '', fecha_desde: '', fecha_hasta: '', motivo: '', observacion: '',
  }
  const [form, setForm] = useState<ContratoForm>(EMPTY_CONTRATO)
  const agent = useAgentSearch()

  const { data: cambios = [], isLoading } = useQuery({
    queryKey: ['cambios-contrato', filterTipo, filterContrato],
    queryFn: () => cambiosContratoApi.list({
      ...(filterTipo && { tipo: filterTipo }),
      ...(filterContrato && { contrato_nuevo: filterContrato }),
    }).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => cambiosContratoApi.create(data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-contrato'] }); toast.success('Cambio de contrato registrado'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear'),
  })
  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => cambiosContratoApi.bulk(data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cambios-contrato'] })
      if (data.creados.length > 0) toast.success(`${data.creados.length} cambio${data.creados.length > 1 ? 's' : ''} registrado${data.creados.length > 1 ? 's' : ''}`)
      if (data.no_encontrados.length > 0) toast.error(`DNI no encontrados: ${data.no_encontrados.join(', ')}`)
      if (data.creados.length > 0) closeForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear en lote'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => cambiosContratoApi.update(id, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-contrato'] }); toast.success('Cambio actualizado'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al actualizar'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => cambiosContratoApi.delete(id).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-contrato'] }); toast.success('Cambio eliminado') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  })

  function openEdit(c: CambioContrato) {
    setEditId(c.id)
    setForm({
      agente_id: String(c.agente_id), agente_nombre: c.agente_nombre, agente_dni: c.agente_dni,
      contrato_anterior: c.contrato_anterior || '', tipo: c.tipo, contrato_nuevo: c.contrato_nuevo,
      fecha_desde: c.fecha_desde.split('T')[0], fecha_hasta: c.fecha_hasta ? c.fecha_hasta.split('T')[0] : '',
      motivo: c.motivo || '', observacion: c.observacion || '',
    })
    agent.setQuery(c.agente_nombre)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_CONTRATO); agent.clear(); setBulkMode(false); setDniInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (bulkMode) {
      const dnis = dniInput.split(/[,\n]+/).map((d) => d.trim()).filter(Boolean)
      bulkCreateMutation.mutate({
        agente_dnis: dnis, tipo: form.tipo, contrato_nuevo: form.contrato_nuevo,
        fecha_desde: form.fecha_desde, fecha_hasta: form.tipo === 'TEMPORAL' ? form.fecha_hasta || null : null,
        motivo: form.motivo || null, observacion: form.observacion || null,
      })
      return
    }
    const payload = {
      agente_id: parseInt(form.agente_id), tipo: form.tipo, contrato_nuevo: form.contrato_nuevo,
      fecha_desde: form.fecha_desde, fecha_hasta: form.tipo === 'TEMPORAL' ? form.fecha_hasta || null : null,
      motivo: form.motivo || null, observacion: form.observacion || null,
    }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const parsedDnis = bulkMode ? dniInput.split(/[,\n]+/).map((d) => d.trim()).filter(Boolean) : []
  const isBusy = createMutation.isPending || updateMutation.isPending || bulkCreateMutation.isPending
  const canSubmit = bulkMode
    ? parsedDnis.length > 0 && !!form.contrato_nuevo && !!form.fecha_desde && (form.tipo === 'DEFINITIVO' || !!form.fecha_hasta)
    : !!form.agente_id && !!form.contrato_nuevo && !!form.fecha_desde && (form.tipo === 'DEFINITIVO' || !!form.fecha_hasta)

  if (isLoading) return <PageLoading />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-3">
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="input-base text-sm">
            <option value="">Todos los tipos</option>
            <option value="DEFINITIVO">Definitivo</option>
            <option value="TEMPORAL">Temporal</option>
          </select>
          <select value={filterContrato} onChange={(e) => setFilterContrato(e.target.value)} className="input-base text-sm">
            <option value="">Todas las jornadas</option>
            {CONTRATOS.map((c) => <option key={c} value={c}>{c} hs</option>)}
          </select>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nuevo cambio de contrato
        </button>
      </div>

      {cambios.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <FilePen size={40} className="mb-2 opacity-30" />
          <p className="text-sm">No hay cambios de contrato registrados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th">Cambio</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td">
                      <p className="font-medium text-gray-900 text-sm">{c.agente_nombre}</p>
                      <p className="text-xs text-gray-400">{c.agente_dni}</p>
                    </td>
                    <td className="table-td">
                      {c.servicio ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full" style={{ background: c.servicio.color }} />
                          {c.servicio.nombre}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c.tipo === 'TEMPORAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {c.tipo === 'TEMPORAL' ? 'Temporal' : 'Definitivo'}
                      </span>
                    </td>
                    <td className="table-td text-sm">
                      <span className="text-gray-400">{c.contrato_anterior ?? '?'} hs</span>
                      <span className="mx-1.5 text-gray-300">→</span>
                      <span className="font-semibold text-gray-900">{c.contrato_nuevo} hs</span>
                    </td>
                    <td className="table-td text-xs text-gray-600">{formatDate(c.fecha_desde)}</td>
                    <td className="table-td text-xs text-gray-500">
                      {c.fecha_hasta ? formatDate(c.fecha_hasta) : <span className="italic text-gray-400">Permanente</span>}
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${estadoBadge(c.estado_calculado)}`}>
                        {c.estado_calculado ?? '—'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Editar"><Pencil size={14} /></button>
                        {isAdmin && (
                          <button onClick={() => setPendingDelete({ id: c.id, nombre: c.agente_nombre })} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Eliminar"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editId ? 'Editar cambio de contrato' : 'Nuevo cambio de contrato'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">{bulkMode ? 'DNIs *' : 'Agente *'}</label>
                  {!editId && (
                    <button type="button"
                      onClick={() => { setBulkMode((v) => !v); setDniInput(''); agent.clear(); setForm((p) => ({ ...p, agente_id: '', agente_nombre: '', agente_dni: '', contrato_anterior: '' })) }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {bulkMode ? 'Buscar por nombre' : 'Agregar varios DNI'}
                    </button>
                  )}
                </div>

                {bulkMode ? (
                  <div>
                    <textarea value={dniInput} onChange={(e) => setDniInput(e.target.value)}
                      placeholder={'Ej: 39882976,44567876,55123456\n(separados por coma o salto de línea)'}
                      rows={3} className="input-base w-full resize-none font-mono" autoFocus />
                    {parsedDnis.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{parsedDnis.length} DNI{parsedDnis.length > 1 ? 's' : ''} ingresado{parsedDnis.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                ) : (
                  <div ref={agent.ref} className="relative">
                    {form.agente_id ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-blue-900">{form.agente_nombre}</p>
                          <p className="text-xs text-blue-600">DNI: {form.agente_dni}{form.contrato_anterior && ` · Contrato actual: ${form.contrato_anterior} hs`}</p>
                        </div>
                        {!editId && <button type="button" onClick={() => { agent.clear(); setForm((p) => ({ ...p, agente_id: '', agente_nombre: '', agente_dni: '', contrato_anterior: '' })) }} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="text" value={agent.query}
                            onChange={(e) => { agent.setQuery(e.target.value); agent.setShowResults(true) }}
                            onFocus={() => agent.query.length >= 2 && agent.setShowResults(true)}
                            placeholder="Buscar por nombre o DNI..." className="input-base pl-9 w-full" autoFocus />
                        </div>
                        {agent.showResults && agent.query.length >= 2 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {agent.results.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                            ) : agent.results.map((a) => (
                              <button key={a.id} type="button"
                                onClick={() => { agent.select(a); setForm((p) => ({ ...p, agente_id: String(a.id), agente_nombre: a.nombre, agente_dni: a.dni, contrato_anterior: a.contrato || '' })) }}
                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                                <p className="text-xs text-gray-500">DNI: {a.dni}{a.contrato ? ` · ${a.contrato} hs` : ''}{a.servicio ? ` · ${a.servicio.nombre}` : ''}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de cambio *</label>
                <div className="flex gap-3">
                  {(['DEFINITIVO', 'TEMPORAL'] as const).map((t) => (
                    <label key={t} className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium transition-all ${form.tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" className="sr-only" value={t} checked={form.tipo === t}
                        onChange={() => setForm((p) => ({ ...p, tipo: t, fecha_hasta: '' }))} />
                      {t === 'DEFINITIVO' ? 'Definitivo' : 'Temporal'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jornada nueva *</label>
                <div className="flex gap-3">
                  {CONTRATOS.map((c) => (
                    <label key={c} className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-semibold transition-all ${form.contrato_nuevo === c ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" className="sr-only" value={c} checked={form.contrato_nuevo === c}
                        onChange={() => setForm((p) => ({ ...p, contrato_nuevo: c }))} />
                      {c} hs
                    </label>
                  ))}
                </div>
              </div>

              <div className={`grid gap-3 ${form.tipo === 'TEMPORAL' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha desde *</label>
                  <input type="date" required value={form.fecha_desde}
                    onChange={(e) => setForm((p) => ({ ...p, fecha_desde: e.target.value }))} className="input-base w-full" />
                </div>
                {form.tipo === 'TEMPORAL' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha hasta *</label>
                    <input type="date" required value={form.fecha_hasta} min={form.fecha_desde}
                      onChange={(e) => setForm((p) => ({ ...p, fecha_hasta: e.target.value }))} className="input-base w-full" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} className="input-base w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observación <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={form.observacion} onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))} rows={2} className="input-base w-full resize-none" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeForm} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" disabled={isBusy || !canSubmit} className="flex-1 btn-primary disabled:opacity-50">
                  {isBusy ? 'Guardando...' : editId ? 'Guardar cambios' : bulkMode && parsedDnis.length > 0 ? `Registrar para ${parsedDnis.length} agente${parsedDnis.length > 1 ? 's' : ''}` : 'Registrar'}
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
        message={`¿Eliminar el cambio de contrato de ${pendingDelete?.nombre}?`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─── Tab Horario ──────────────────────────────────────────────────────────────
function TabHorario({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [filterTipo, setFilterTipo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; nombre: string } | null>(null)

  interface HorarioForm {
    agente_id: string; agente_nombre: string; agente_dni: string; horario_anterior: string
    tipo: 'TEMPORAL' | 'DEFINITIVO'; horario_nuevo: string
    fecha_desde: string; fecha_hasta: string; motivo: string; observacion: string
  }
  const EMPTY_HORARIO: HorarioForm = {
    agente_id: '', agente_nombre: '', agente_dni: '', horario_anterior: '',
    tipo: 'DEFINITIVO', horario_nuevo: '', fecha_desde: '', fecha_hasta: '', motivo: '', observacion: '',
  }
  const [form, setForm] = useState<HorarioForm>(EMPTY_HORARIO)
  const agent = useAgentSearch()

  const { data: cambios = [], isLoading } = useQuery({
    queryKey: ['cambios-horario', filterTipo],
    queryFn: () => cambiosHorarioApi.list({ ...(filterTipo && { tipo: filterTipo }) }).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => cambiosHorarioApi.create(data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-horario'] }); toast.success('Cambio de horario registrado'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => cambiosHorarioApi.update(id, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-horario'] }); toast.success('Cambio de horario actualizado'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al actualizar'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => cambiosHorarioApi.delete(id).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cambios-horario'] }); toast.success('Cambio eliminado') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  })

  function openEdit(c: CambioHorario) {
    setEditId(c.id)
    setForm({
      agente_id: String(c.agente_id), agente_nombre: c.agente_nombre, agente_dni: c.agente_dni,
      horario_anterior: c.horario_anterior || '', tipo: c.tipo, horario_nuevo: c.horario_nuevo,
      fecha_desde: c.fecha_desde.split('T')[0], fecha_hasta: c.fecha_hasta ? c.fecha_hasta.split('T')[0] : '',
      motivo: c.motivo || '', observacion: c.observacion || '',
    })
    agent.setQuery(c.agente_nombre)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_HORARIO); agent.clear()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      agente_id: parseInt(form.agente_id), tipo: form.tipo, horario_nuevo: form.horario_nuevo,
      fecha_desde: form.fecha_desde, fecha_hasta: form.tipo === 'TEMPORAL' ? form.fecha_hasta || null : null,
      motivo: form.motivo || null, observacion: form.observacion || null,
    }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const isBusy = createMutation.isPending || updateMutation.isPending
  const canSubmit = !!form.agente_id && !!form.horario_nuevo && !!form.fecha_desde && (form.tipo === 'DEFINITIVO' || !!form.fecha_hasta)

  if (isLoading) return <PageLoading />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="input-base text-sm">
          <option value="">Todos los tipos</option>
          <option value="DEFINITIVO">Definitivo</option>
          <option value="TEMPORAL">Temporal</option>
        </select>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nuevo cambio de horario
        </button>
      </div>

      {cambios.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Clock size={40} className="mb-2 opacity-30" />
          <p className="text-sm">No hay cambios de horario registrados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th">Cambio</th>
                  <th className="table-th">Desde</th>
                  <th className="table-th">Hasta</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td">
                      <p className="font-medium text-gray-900 text-sm">{c.agente_nombre}</p>
                      <p className="text-xs text-gray-400">{c.agente_dni}</p>
                    </td>
                    <td className="table-td">
                      {c.servicio ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full" style={{ background: c.servicio.color }} />
                          {c.servicio.nombre}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c.tipo === 'TEMPORAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {c.tipo === 'TEMPORAL' ? 'Temporal' : 'Definitivo'}
                      </span>
                    </td>
                    <td className="table-td text-sm">
                      <span className="text-gray-400">{c.horario_anterior ?? '?'}</span>
                      <span className="mx-1.5 text-gray-300">→</span>
                      <span className="font-semibold text-gray-900">{c.horario_nuevo}</span>
                    </td>
                    <td className="table-td text-xs text-gray-600">{formatDate(c.fecha_desde)}</td>
                    <td className="table-td text-xs text-gray-500">
                      {c.fecha_hasta ? formatDate(c.fecha_hasta) : <span className="italic text-gray-400">Permanente</span>}
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${estadoBadge(c.estado_calculado)}`}>
                        {c.estado_calculado ?? '—'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Editar"><Pencil size={14} /></button>
                        {isAdmin && (
                          <button onClick={() => setPendingDelete({ id: c.id, nombre: c.agente_nombre })} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Eliminar"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editId ? 'Editar cambio de horario' : 'Nuevo cambio de horario'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div ref={agent.ref} className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Agente *</label>
                {form.agente_id ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-900">{form.agente_nombre}</p>
                      <p className="text-xs text-blue-600">DNI: {form.agente_dni}{form.horario_anterior && ` · Horario actual: ${form.horario_anterior}`}</p>
                    </div>
                    {!editId && <button type="button" onClick={() => { agent.clear(); setForm((p) => ({ ...p, agente_id: '', agente_nombre: '', agente_dni: '', horario_anterior: '' })) }} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={agent.query}
                        onChange={(e) => { agent.setQuery(e.target.value); agent.setShowResults(true) }}
                        onFocus={() => agent.query.length >= 2 && agent.setShowResults(true)}
                        placeholder="Buscar por nombre o DNI..." className="input-base pl-9 w-full" autoFocus />
                    </div>
                    {agent.showResults && agent.query.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {agent.results.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                        ) : agent.results.map((a) => (
                          <button key={a.id} type="button"
                            onClick={() => { agent.select(a); setForm((p) => ({ ...p, agente_id: String(a.id), agente_nombre: a.nombre, agente_dni: a.dni, horario_anterior: a.horarios || '' })) }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                            <p className="text-xs text-gray-500">DNI: {a.dni}{a.horarios ? ` · ${a.horarios}` : ''}{a.servicio ? ` · ${a.servicio.nombre}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de cambio *</label>
                <div className="flex gap-3">
                  {(['DEFINITIVO', 'TEMPORAL'] as const).map((t) => (
                    <label key={t} className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium transition-all ${form.tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" className="sr-only" value={t} checked={form.tipo === t}
                        onChange={() => setForm((p) => ({ ...p, tipo: t, fecha_hasta: '' }))} />
                      {t === 'DEFINITIVO' ? 'Definitivo' : 'Temporal'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Horario nuevo *</label>
                <input type="text" value={form.horario_nuevo} required
                  onChange={(e) => setForm((p) => ({ ...p, horario_nuevo: e.target.value }))}
                  placeholder="Ej: 14:00, Tarde, Noche..." className="input-base w-full" />
              </div>

              <div className={`grid gap-3 ${form.tipo === 'TEMPORAL' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha desde *</label>
                  <input type="date" required value={form.fecha_desde}
                    onChange={(e) => setForm((p) => ({ ...p, fecha_desde: e.target.value }))} className="input-base w-full" />
                </div>
                {form.tipo === 'TEMPORAL' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha hasta *</label>
                    <input type="date" required value={form.fecha_hasta} min={form.fecha_desde}
                      onChange={(e) => setForm((p) => ({ ...p, fecha_hasta: e.target.value }))} className="input-base w-full" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} className="input-base w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observación <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={form.observacion} onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))} rows={2} className="input-base w-full resize-none" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeForm} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" disabled={isBusy || !canSubmit} className="flex-1 btn-primary disabled:opacity-50">
                  {isBusy ? 'Guardando...' : editId ? 'Guardar cambios' : 'Registrar'}
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
        title="Eliminar cambio de horario"
        message={`¿Eliminar el cambio de horario de ${pendingDelete?.nombre}?`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Cambios() {
  const isAdmin = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR')
  const [tab, setTab] = useState<Tab>('servicio')

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Cambios"
        subtitle="Gestión de cambios de servicio, contrato y horario"
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'servicio' && <TabServicio isAdmin={!!isAdmin} />}
        {tab === 'contrato' && <TabContrato isAdmin={!!isAdmin} />}
        {tab === 'horario' && <TabHorario isAdmin={!!isAdmin} />}
      </div>
    </div>
  )
}
