import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, X, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'
import { capacitacionesApi, agentesApi, serviciosApi, bajasApi } from '../lib/api'
import type { Capacitacion, Agente } from '../types'

interface CapForm {
  agente_id: string
  agente_nombre: string
  agente_dni: string
  usuario_sistema: string
  superior: string
  servicio_id: string
  servicio_nombre: string
  segmento: string
  horarios: string
  estado: string
  contrato: string
  sitio: string
  modalidad: string
  jefe: string
  observacion: string
  fecha_inicio: string
  fecha_fin: string
}

const FORM_EMPTY: CapForm = {
  agente_id: '', agente_nombre: '', agente_dni: '',
  usuario_sistema: '', superior: '', servicio_id: '', servicio_nombre: '',
  segmento: '', horarios: '', estado: '', contrato: '',
  sitio: '', modalidad: '', jefe: '', observacion: '',
  fecha_inicio: '', fecha_fin: '',
}

function formatDate(iso: string) {
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function estadoClass(estado?: string) {
  if (estado === 'VIGENTE') return 'bg-green-100 text-green-800'
  if (estado === 'PROGRAMADA') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-600'
}

const CONTRATOS = ['30', '35', '36']

export default function Capacitaciones() {
  const { user } = useAuthStore()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const qc = useQueryClient()

  const [filterServicio, setFilterServicio] = useState('')
  const [filterSegmento, setFilterSegmento] = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<CapForm>(FORM_EMPTY)

  const [agentQuery, setAgentQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const f = (k: keyof CapForm, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: opciones } = useQuery({
    queryKey: ['bajas-opciones', form.servicio_id],
    queryFn: () => bajasApi.opciones(form.servicio_id ? parseInt(form.servicio_id) : undefined).then((r) => r.data),
    enabled: showForm,
  })

  const { data: caps = [], isLoading } = useQuery({
    queryKey: ['capacitaciones', filterServicio, filterSegmento, filterEstado],
    queryFn: () =>
      capacitacionesApi.list({
        ...(filterServicio && { servicio_id: parseInt(filterServicio) }),
        ...(filterSegmento && { segmento: filterSegmento }),
        ...(filterEstado && { estado_cap: filterEstado }),
      }).then((r) => r.data),
  })

  const { data: agentResults = [] } = useQuery({
    queryKey: ['agentes-search-cap', agentQuery],
    queryFn: () => agentesApi.list({ search: agentQuery }).then((r) => r.data),
    enabled: agentQuery.length >= 2,
  })

  const createMut = useMutation({
    mutationFn: (data: any) => capacitacionesApi.create(data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacitaciones'] }); toast.success('Capacitación registrada'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => capacitacionesApi.update(id, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacitaciones'] }); toast.success('Capacitación actualizada'); closeForm() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al actualizar'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => capacitacionesApi.delete(id).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacitaciones'] }); toast.success('Capacitación eliminada') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  })

  function selectAgent(a: Agente) {
    setForm((p) => ({
      ...p,
      agente_id: String(a.id),
      agente_nombre: a.nombre,
      agente_dni: a.dni,
      usuario_sistema: a.usuario || '',
      superior: a.superior || '',
      servicio_id: a.servicio_id ? String(a.servicio_id) : '',
      servicio_nombre: a.servicio?.nombre || '',
      segmento: a.segmento || '',
      horarios: a.horarios || '',
      estado: a.estado || '',
      contrato: a.contrato || '',
      sitio: a.sitio || '',
      modalidad: a.modalidad || '',
      jefe: a.jefe || '',
    }))
    setAgentQuery(a.nombre)
    setShowResults(false)
  }

  function clearAgent() {
    setForm((p) => ({ ...p, agente_id: '', agente_nombre: '', agente_dni: '', usuario_sistema: '' }))
    setAgentQuery('')
  }

  function openEdit(c: Capacitacion) {
    setEditId(c.id)
    setForm({
      agente_id: c.agente_id ? String(c.agente_id) : '',
      agente_nombre: c.agente_nombre,
      agente_dni: c.agente_dni || '',
      usuario_sistema: c.usuario_sistema || '',
      superior: c.superior || '',
      servicio_id: c.servicio_id ? String(c.servicio_id) : '',
      servicio_nombre: c.servicio_nombre || '',
      segmento: c.segmento ?? 'SIN_DEFINIR',
      horarios: c.horarios || '',
      estado: c.estado || '',
      contrato: c.contrato || '',
      sitio: c.sitio || '',
      modalidad: c.modalidad || '',
      jefe: c.jefe || '',
      observacion: c.observacion || '',
      fecha_inicio: c.fecha_inicio.split('T')[0],
      fecha_fin: c.fecha_fin.split('T')[0],
    })
    setAgentQuery(c.agente_nombre)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(FORM_EMPTY)
    setAgentQuery('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      agente_id: form.agente_id || null,
      agente_dni: form.agente_dni || null,
      agente_nombre: form.agente_nombre,
      usuario_sistema: form.usuario_sistema || null,
      superior: form.superior || null,
      servicio_id: form.servicio_id ? parseInt(form.servicio_id) : null,
      servicio_nombre: form.servicio_nombre || null,
      segmento: form.segmento || null,
      horarios: form.horarios || null,
      estado: form.estado || null,
      contrato: form.contrato || null,
      sitio: form.sitio || null,
      modalidad: form.modalidad || null,
      jefe: form.jefe || null,
      observacion: form.observacion || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
    }
    if (editId) updateMut.mutate({ id: editId, data: payload })
    else createMut.mutate(payload)
  }

  const isBusy = createMut.isPending || updateMut.isPending
  const canSubmit = !!form.agente_nombre && !!form.fecha_inicio && !!form.fecha_fin

  // Segmentos disponibles: opciones del servicio + "Sin definir"
  const segmentosDisponibles = ['SIN_DEFINIR', ...(opciones?.segmentos ?? [])]

  // Segmentos para filtro de tabla: del total de caps
  const segmentosUnicos = [...new Set(caps.map((c) => c.segmento ?? 'SIN_DEFINIR'))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Capacitaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agentes en proceso de formación y su período</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva capacitación
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select value={filterServicio} onChange={(e) => setFilterServicio(e.target.value)} className="input-field text-sm h-9 min-w-[180px]">
          <option value="">Todos los servicios</option>
          {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        <select value={filterSegmento} onChange={(e) => setFilterSegmento(e.target.value)} className="input-field text-sm h-9 min-w-[160px]">
          <option value="">Todos los segmentos</option>
          <option value="SIN_DEFINIR">Sin definir</option>
          {segmentosUnicos.filter((s) => s !== 'SIN_DEFINIR').map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="input-field text-sm h-9">
          <option value="">Todos los estados</option>
          <option value="VIGENTE">Vigente</option>
          <option value="PROGRAMADA">Programada</option>
          <option value="FINALIZADA">Finalizada</option>
        </select>

        {(filterServicio || filterSegmento || filterEstado) && (
          <button onClick={() => { setFilterServicio(''); setFilterSegmento(''); setFilterEstado('') }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X size={14} /> Limpiar
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">{caps.length} registros</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>
        ) : caps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <GraduationCap size={40} className="mb-2 opacity-30" />
            <p className="text-sm">No hay capacitaciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Agente</th>
                  <th className="table-th">Servicio / Segmento</th>
                  <th className="table-th">Inicio</th>
                  <th className="table-th">Fin</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th w-16"></th>
                </tr>
              </thead>
              <tbody>
                {caps.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-td">
                      <p className="font-medium text-gray-900 text-sm">{c.agente_nombre}</p>
                      {c.agente_dni && <p className="text-xs text-gray-400">{c.agente_dni}</p>}
                      {c.usuario_sistema && <p className="text-xs text-gray-400">{c.usuario_sistema}</p>}
                    </td>
                    <td className="table-td">
                      {c.servicio ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 mb-0.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.servicio.color }} />
                          {c.servicio.nombre}
                        </span>
                      ) : c.servicio_nombre ? (
                        <span className="text-xs text-gray-600">{c.servicio_nombre}</span>
                      ) : null}
                      {c.segmento ? (
                        <p className="text-xs text-gray-500">{c.segmento}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sin definir</p>
                      )}
                    </td>
                    <td className="table-td text-sm text-gray-600">{formatDate(c.fecha_inicio)}</td>
                    <td className="table-td text-sm text-gray-600">{formatDate(c.fecha_fin)}</td>
                    <td className="table-td">
                      <span className={`badge text-xs ${estadoClass(c.estado_calculado)}`}>
                        {c.estado_calculado ?? '—'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => { if (confirm(`¿Eliminar la capacitación de ${c.agente_nombre}?`)) deleteMut.mutate(c.id) }}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {editId ? 'Editar capacitación' : 'Nueva capacitación'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Agent search */}
              <div ref={searchRef} className="relative">
                <label className="form-label">Agente</label>
                {form.agente_id ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-900">{form.agente_nombre}</p>
                      <p className="text-xs text-blue-600">
                        {form.agente_dni && `DNI: ${form.agente_dni}`}
                        {form.usuario_sistema && ` · ${form.usuario_sistema}`}
                        {form.servicio_nombre && ` · ${form.servicio_nombre}`}
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
                        placeholder="Buscar por nombre o DNI…"
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
                            <button key={a.id} type="button" onClick={() => selectAgent(a)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                              <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                              <p className="text-xs text-gray-500">
                                {a.dni}{a.contrato ? ` · ${a.contrato} hs` : ''}{a.servicio ? ` · ${a.servicio.nombre}` : ''}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {/* Allow manual entry if no agent found */}
                    {!form.agente_id && (
                      <p className="text-xs text-gray-400 mt-1">
                        También podés escribir el nombre manualmente:
                        <input
                          type="text"
                          value={form.agente_nombre}
                          onChange={(e) => f('agente_nombre', e.target.value)}
                          placeholder="Nombre del agente"
                          className="input-field text-sm mt-1.5"
                        />
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Nomina fields */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos de nómina</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">DNI</label>
                    <input type="text" value={form.agente_dni} onChange={(e) => f('agente_dni', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>
                  <div>
                    <label className="form-label">Usuario sistema</label>
                    <input type="text" value={form.usuario_sistema} onChange={(e) => f('usuario_sistema', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>

                  <div>
                    <label className="form-label">Superior</label>
                    {opciones?.superiores?.length ? (
                      <select value={form.superior} onChange={(e) => f('superior', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {opciones.superiores.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.superior} onChange={(e) => f('superior', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>

                  <div>
                    <label className="form-label">Segmento</label>
                    <select value={form.segmento} onChange={(e) => f('segmento', e.target.value)} className="input-field text-sm">
                      <option value="">—</option>
                      <option value="SIN_DEFINIR">Sin definir</option>
                      {opciones?.segmentos?.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Horarios</label>
                    <input type="text" value={form.horarios} onChange={(e) => f('horarios', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>

                  <div>
                    <label className="form-label">Estado</label>
                    {opciones?.estados?.length ? (
                      <select value={form.estado} onChange={(e) => f('estado', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {opciones.estados.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.estado} onChange={(e) => f('estado', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>

                  <div>
                    <label className="form-label">Contrato</label>
                    <select value={form.contrato} onChange={(e) => f('contrato', e.target.value)} className="input-field text-sm">
                      <option value="">—</option>
                      {CONTRATOS.map((c) => <option key={c} value={c}>{c} hs</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Sitio</label>
                    {opciones?.sitios?.length ? (
                      <select value={form.sitio} onChange={(e) => f('sitio', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {opciones.sitios.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.sitio} onChange={(e) => f('sitio', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>

                  <div>
                    <label className="form-label">Modalidad</label>
                    <input type="text" value={form.modalidad} onChange={(e) => f('modalidad', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>

                  <div>
                    <label className="form-label">Jefe</label>
                    {opciones?.jefes?.length ? (
                      <select value={form.jefe} onChange={(e) => f('jefe', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {opciones.jefes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.jefe} onChange={(e) => f('jefe', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label">Observación</label>
                  <textarea value={form.observacion} onChange={(e) => f('observacion', e.target.value)} rows={2} className="input-field text-sm resize-none" placeholder="—" />
                </div>
              </div>

              {/* Period */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Período de capacitación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Fecha inicio</label>
                    <input type="date" required value={form.fecha_inicio} onChange={(e) => f('fecha_inicio', e.target.value)} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="form-label">Fecha fin</label>
                    <input type="date" required value={form.fecha_fin} min={form.fecha_inicio} onChange={(e) => f('fecha_fin', e.target.value)} className="input-field text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" disabled={isBusy || !canSubmit} className="flex-1 btn-primary disabled:opacity-50">
                  {isBusy ? 'Guardando...' : editId ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
