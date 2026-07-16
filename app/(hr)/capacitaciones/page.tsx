"use client";

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, X, GraduationCap, UserCheck, UserPlus, ArrowUpCircle, Clock, BookOpen, Layers } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth'
import { capacitacionesApi, agentesApi, serviciosApi, bajasApi } from '@/lib/api'
import ConfirmDialog from '@/components/hr/ui/ConfirmDialog'
import Header from '@/components/hr/layout/Header'
import KpiCard from '@/components/hr/ui/KpiCard'
import type { Capacitacion, Agente } from '@/types'

type TipoAgente = 'existente' | 'nuevo'

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
  tipo_formacion: string
  fecha_inicio: string
  fecha_fin: string
}

const FORM_EMPTY: CapForm = {
  agente_id: '', agente_nombre: '', agente_dni: '',
  usuario_sistema: '', superior: '', servicio_id: '', servicio_nombre: '',
  segmento: '', horarios: '', estado: '', contrato: '',
  sitio: '', modalidad: '', jefe: '', observacion: '',
  tipo_formacion: '',
  fecha_inicio: '', fecha_fin: '',
}

function formatDate(iso: string) {
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function estadoClass(estado?: string) {
  if (estado === 'VIGENTE') return 'bg-green-100 text-green-700 border border-green-200'
  if (estado === 'PROGRAMADA') return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  return 'bg-gray-100 text-gray-500 border border-gray-200'
}

const CONTRATOS = ['30', '35', '36']

function tipoFormacionBadge(tipo?: string | null) {
  if (tipo === 'OJT') return 'bg-purple-100 text-purple-700 border border-purple-200'
  if (tipo === 'TRAINING') return 'bg-blue-100 text-blue-700 border border-blue-200'
  return 'bg-gray-100 text-gray-400'
}

export default function Capacitaciones() {
  const { user } = useAuthStore()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const qc = useQueryClient()

  const [filterServicio, setFilterServicio] = useState('')
  const [filterSegmento, setFilterSegmento] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterTipo, setFilterTipo] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [tipoAgente, setTipoAgente] = useState<TipoAgente>('existente')
  const [form, setForm] = useState<CapForm>(FORM_EMPTY)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; nombre: string } | null>(null)

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
    queryKey: ['capacitaciones', filterServicio, filterSegmento, filterEstado, filterTipo],
    queryFn: () =>
      capacitacionesApi.list({
        ...(filterServicio && { servicio_id: parseInt(filterServicio) }),
        ...(filterSegmento && { segmento: filterSegmento }),
        ...(filterEstado && { estado_cap: filterEstado }),
        ...(filterTipo && { tipo_formacion: filterTipo }),
      }).then((r) => r.data),
  })

  const { data: agentResults = [] } = useQuery({
    queryKey: ['agentes-search-cap', agentQuery],
    queryFn: () => agentesApi.list({ search: agentQuery }).then((r) => r.data.data),
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

  const [altaModal, setAltaModal] = useState<Capacitacion | null>(null)
  interface AltaForm { fecha_alta: string; segmento: string; superior: string; horarios: string; estado: string; contrato: string; sitio: string; modalidad: string; jefe: string }
  const emptyAlta = (cap: Capacitacion): AltaForm => ({
    fecha_alta: format(new Date(), 'yyyy-MM-dd'),
    segmento: cap.segmento ?? '',
    superior: cap.superior ?? '',
    horarios: cap.horarios ?? '',
    estado: cap.estado ?? '',
    contrato: cap.contrato ?? '',
    sitio: cap.sitio ?? '',
    modalidad: cap.modalidad ?? '',
    jefe: cap.jefe ?? '',
  })
  const [altaForm, setAltaForm] = useState<AltaForm>({ fecha_alta: '', segmento: '', superior: '', horarios: '', estado: '', contrato: '', sitio: '', modalidad: '', jefe: '' })
  const af = (k: keyof AltaForm, v: string) => setAltaForm((p) => ({ ...p, [k]: v }))

  const altaServicioId = altaModal?.servicio_id ?? undefined
  const { data: altaOpciones } = useQuery({
    queryKey: ['bajas-opciones', altaServicioId],
    queryFn: () => bajasApi.opciones(altaServicioId).then((r) => r.data),
    enabled: !!altaModal,
  })

  const darDeAltaMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => capacitacionesApi.darDeAlta(id, data).then((r) => r.data),
    onSuccess: (cap) => {
      qc.invalidateQueries({ queryKey: ['capacitaciones'] })
      setAltaModal(null)
      if (cap.pendiente_alta) {
        toast.success('Quedó PENDIENTE: se agregará cuando se cargue la nómina del mes indicado')
      } else {
        toast.success('Agente dado de alta en la nómina')
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al dar de alta'),
  })

  function openAlta(c: Capacitacion) {
    setAltaModal(c)
    setAltaForm(emptyAlta(c))
  }

  function handleAltaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!altaModal) return
    darDeAltaMut.mutate({ id: altaModal.id, data: altaForm })
  }

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
    setForm(FORM_EMPTY)
    setAgentQuery('')
  }

  function switchTipo(tipo: TipoAgente) {
    setTipoAgente(tipo)
    setForm(FORM_EMPTY)
    setAgentQuery('')
  }

  function openEdit(c: Capacitacion) {
    setEditId(c.id)
    setTipoAgente(c.agente_id ? 'existente' : 'nuevo')
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
      tipo_formacion: c.tipo_formacion || '',
      fecha_inicio: c.fecha_inicio.split('T')[0],
      fecha_fin: c.fecha_fin.split('T')[0],
    })
    setAgentQuery(c.agente_nombre)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setTipoAgente('existente')
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
      tipo_formacion: form.tipo_formacion || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
    }
    if (editId) updateMut.mutate({ id: editId, data: payload })
    else createMut.mutate(payload)
  }

  const isBusy = createMut.isPending || updateMut.isPending
  const canSubmit = !!form.agente_nombre && !!form.fecha_inicio && !!form.fecha_fin &&
    (tipoAgente === 'nuevo' || !!form.agente_id)

  const segmentosUnicos = [...new Set(caps.map((c) => c.segmento ?? 'SIN_DEFINIR'))]
  const totalOjt = caps.filter((c) => c.tipo_formacion === 'OJT').length
  const totalTraining = caps.filter((c) => c.tipo_formacion === 'TRAINING').length
  const totalVigentes = caps.filter((c) => c.estado_calculado === 'VIGENTE').length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Formador"
        subtitle="Agentes en proceso de formación — OJT y Training"
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Nueva capacitación
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total en formación" value={caps.length} icon={GraduationCap} color="blue" />
          <KpiCard title="Vigentes" value={totalVigentes} icon={Clock} color="green" subtitle="Actualmente en curso" />
          <KpiCard title="OJT" value={totalOjt} icon={Layers} color="purple" />
          <KpiCard title="Training" value={totalTraining} icon={BookOpen} color="blue" />
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
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="input-field text-sm h-9">
            <option value="">OJT y Training</option>
            <option value="OJT">OJT</option>
            <option value="TRAINING">Training</option>
          </select>
          {(filterServicio || filterSegmento || filterEstado || filterTipo) && (
            <button onClick={() => { setFilterServicio(''); setFilterSegmento(''); setFilterEstado(''); setFilterTipo('') }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
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
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="table-th">Agente</th>
                    <th className="table-th">Tipo</th>
                    <th className="table-th">Servicio / Segmento</th>
                    <th className="table-th">Período</th>
                    <th className="table-th">Estado</th>
                    <th className="table-th w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {caps.map((c) => (
                    <tr key={c.id} className="table-row border-b border-gray-50 last:border-0">
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500 text-[11px] font-bold">
                            {c.agente_nombre.trim().split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.agente_nombre}</p>
                            <p className="text-xs text-gray-400">
                              {c.agente_dni && `DNI ${c.agente_dni}`}
                              {c.usuario_sistema && ` · ${c.usuario_sistema}`}
                            </p>
                          </div>
                          {!c.agente_id && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                              Nuevo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td">
                        {c.tipo_formacion ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${tipoFormacionBadge(c.tipo_formacion)}`}>
                            {c.tipo_formacion}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="table-td">
                        {c.servicio ? (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.servicio.color }} />
                            <span className="text-xs font-medium text-gray-700">{c.servicio.nombre}</span>
                          </div>
                        ) : c.servicio_nombre ? (
                          <p className="text-xs font-medium text-gray-700 mb-0.5">{c.servicio_nombre}</p>
                        ) : null}
                        <p className="text-xs text-gray-400">{c.segmento || <span className="italic">Sin segmento</span>}</p>
                      </td>
                      <td className="table-td">
                        <p className="text-xs font-medium text-gray-700">{formatDate(c.fecha_inicio)}</p>
                        <p className="text-xs text-gray-400">→ {formatDate(c.fecha_fin)}</p>
                      </td>
                      <td className="table-td">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${estadoClass(c.estado_calculado)}`}>
                            {c.estado_calculado ?? '—'}
                          </span>
                          {c.pendiente_alta && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              <Clock size={9} /> Pendiente alta
                            </span>
                          )}
                          {c.dado_de_alta && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
                              <ArrowUpCircle size={9} /> Dado de alta
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1 justify-end">
                          {c.estado_calculado === 'FINALIZADA' && !c.dado_de_alta && (
                            <button onClick={() => openAlta(c)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors" title="Dar de alta en nómina">
                              <ArrowUpCircle size={15} />
                            </button>
                          )}
                          <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Editar">
                            <Pencil size={15} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setPendingDelete({ id: c.id, nombre: c.agente_nombre })} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar">
                              <Trash2 size={15} />
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
      </div>

      {/* Dar de Alta Modal */}
      {altaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <ArrowUpCircle size={18} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">Dar de alta en nómina</h2>
                  <p className="text-xs text-gray-500">{altaModal.agente_nombre}</p>
                </div>
              </div>
              <button onClick={() => setAltaModal(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAltaSubmit} className="p-6 space-y-5">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">
                Indicá en qué mes/año debe incorporarse a la nómina. Si esa nómina aún no existe, quedará <strong>pendiente</strong> y se agregará automáticamente cuando se cargue.
              </div>

              <div>
                <label className="form-label">Fecha de incorporación <span className="text-red-400">*</span></label>
                <input type="date" required value={altaForm.fecha_alta} onChange={(e) => af('fecha_alta', e.target.value)} className="input-field text-sm" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Datos de nómina</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Segmento</label>
                    <select value={altaForm.segmento} onChange={(e) => af('segmento', e.target.value)} className="input-field text-sm">
                      <option value="">—</option>
                      <option value="SIN_DEFINIR">Sin definir</option>
                      {altaOpciones?.segmentos?.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Superior</label>
                    {altaOpciones?.superiores?.length ? (
                      <select value={altaForm.superior} onChange={(e) => af('superior', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {altaOpciones.superiores.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={altaForm.superior} onChange={(e) => af('superior', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>
                  <div>
                    <label className="form-label">Horarios</label>
                    <input type="text" value={altaForm.horarios} onChange={(e) => af('horarios', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>
                  <div>
                    <label className="form-label">Estado</label>
                    {altaOpciones?.estados?.length ? (
                      <select value={altaForm.estado} onChange={(e) => af('estado', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {altaOpciones.estados.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={altaForm.estado} onChange={(e) => af('estado', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>
                  <div>
                    <label className="form-label">Contrato</label>
                    <select value={altaForm.contrato} onChange={(e) => af('contrato', e.target.value)} className="input-field text-sm">
                      <option value="">—</option>
                      {['30', '35', '36'].map((c) => <option key={c} value={c}>{c} hs</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Sitio</label>
                    {altaOpciones?.sitios?.length ? (
                      <select value={altaForm.sitio} onChange={(e) => af('sitio', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {altaOpciones.sitios.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={altaForm.sitio} onChange={(e) => af('sitio', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>
                  <div>
                    <label className="form-label">Modalidad</label>
                    <input type="text" value={altaForm.modalidad} onChange={(e) => af('modalidad', e.target.value)} className="input-field text-sm" placeholder="—" />
                  </div>
                  <div>
                    <label className="form-label">Jefe</label>
                    {altaOpciones?.jefes?.length ? (
                      <select value={altaForm.jefe} onChange={(e) => af('jefe', e.target.value)} className="input-field text-sm">
                        <option value="">—</option>
                        {altaOpciones.jefes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={altaForm.jefe} onChange={(e) => af('jefe', e.target.value)} className="input-field text-sm" placeholder="—" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAltaModal(null)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" disabled={darDeAltaMut.isPending || !altaForm.fecha_alta} className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                  <ArrowUpCircle size={14} />
                  {darDeAltaMut.isPending ? 'Procesando...' : 'Dar de alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-konecta/10 flex items-center justify-center">
                  <GraduationCap size={18} className="text-konecta" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">
                    {editId ? 'Editar capacitación' : 'Nueva capacitación'}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {editId ? 'Modificá los datos del agente en formación' : 'Registrá un agente en proceso de formación'}
                  </p>
                </div>
              </div>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* Tipo de agente toggle */}
              {!editId && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">¿Quién vas a registrar?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => switchTipo('existente')}
                      className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 text-center transition-all ${
                        tipoAgente === 'existente'
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {tipoAgente === 'existente' && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tipoAgente === 'existente' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <UserCheck size={22} className={tipoAgente === 'existente' ? 'text-blue-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${tipoAgente === 'existente' ? 'text-blue-700' : 'text-gray-600'}`}>
                          Agente existente
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Ya está en el sistema</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchTipo('nuevo')}
                      className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 text-center transition-all ${
                        tipoAgente === 'nuevo'
                          ? 'border-orange-400 bg-orange-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {tipoAgente === 'nuevo' && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-orange-400" />
                      )}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tipoAgente === 'nuevo' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                        <UserPlus size={22} className={tipoAgente === 'nuevo' ? 'text-orange-500' : 'text-gray-400'} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${tipoAgente === 'nuevo' ? 'text-orange-600' : 'text-gray-600'}`}>
                          Agente nuevo
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Ingresante, no está en el sistema</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Agent section */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Datos del agente</p>
                {tipoAgente === 'existente' ? (
                  <div ref={searchRef} className="relative">
                    {form.agente_id ? (
                      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 text-xs font-bold shrink-0">
                            {form.agente_nombre.trim().split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-900">{form.agente_nombre}</p>
                            <p className="text-xs text-blue-500">
                              {form.agente_dni && `DNI: ${form.agente_dni}`}
                              {form.usuario_sistema && ` · ${form.usuario_sistema}`}
                              {form.servicio_nombre && ` · ${form.servicio_nombre}`}
                            </p>
                          </div>
                        </div>
                        {!editId && (
                          <button type="button" onClick={clearAgent} className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition-colors">
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
                            placeholder="Buscá por nombre o DNI…"
                            className="input-field pl-9 text-sm"
                            autoFocus
                          />
                        </div>
                        {showResults && agentQuery.length >= 2 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                            {agentResults.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                            ) : (
                              agentResults.map((a) => (
                                <button key={a.id} type="button" onClick={() => selectAgent(a)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 first:rounded-t-xl last:rounded-b-xl">
                                  <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                                  <p className="text-xs text-gray-400">
                                    {a.dni}{a.contrato ? ` · ${a.contrato} hs` : ''}{a.servicio ? ` · ${a.servicio.nombre}` : ''}
                                  </p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">Nombre completo <span className="text-red-400">*</span></label>
                      <input type="text" required value={form.agente_nombre} onChange={(e) => f('agente_nombre', e.target.value)} placeholder="Apellido y nombre del agente" className="input-field text-sm" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">DNI</label>
                        <input type="text" value={form.agente_dni} onChange={(e) => f('agente_dni', e.target.value)} className="input-field text-sm" placeholder="—" />
                      </div>
                      <div>
                        <label className="form-label">Servicio de destino</label>
                        <select value={form.servicio_id} onChange={(e) => { f('servicio_id', e.target.value); f('servicio_nombre', servicios.find((s) => String(s.id) === e.target.value)?.nombre || '') }} className="input-field text-sm">
                          <option value="">—</option>
                          {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Nomina fields */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Datos de nómina</p>
                <div className="grid grid-cols-2 gap-3">
                  {tipoAgente === 'existente' && (
                    <div>
                      <label className="form-label">DNI</label>
                      <input type="text" value={form.agente_dni} onChange={(e) => f('agente_dni', e.target.value)} className="input-field text-sm" placeholder="—" />
                    </div>
                  )}
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

              {/* Tipo de formación */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tipo de formación</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'OJT', label: 'OJT', desc: 'On the Job Training', color: 'purple' },
                    { key: 'TRAINING', label: 'Training', desc: 'Capacitación formal', color: 'blue' },
                  ].map(({ key, label, desc, color }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => f('tipo_formacion', form.tipo_formacion === key ? '' : key)}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        form.tipo_formacion === key
                          ? `border-${color}-400 bg-${color}-50`
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {form.tipo_formacion === key && (
                        <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-${color}-500`} />
                      )}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${form.tipo_formacion === key ? `bg-${color}-100` : 'bg-gray-100'}`}>
                        {key === 'OJT' ? <Layers size={16} className={form.tipo_formacion === key ? `text-${color}-600` : 'text-gray-400'} /> : <BookOpen size={16} className={form.tipo_formacion === key ? `text-${color}-600` : 'text-gray-400'} />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${form.tipo_formacion === key ? `text-${color}-700` : 'text-gray-600'}`}>{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Período */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Período de formación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Fecha inicio <span className="text-red-400">*</span></label>
                    <input type="date" required value={form.fecha_inicio} onChange={(e) => f('fecha_inicio', e.target.value)} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="form-label">Fecha fin <span className="text-red-400">*</span></label>
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

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) deleteMut.mutate(pendingDelete.id); setPendingDelete(null) }}
        title="Eliminar capacitación"
        message={`¿Eliminar la capacitación de ${pendingDelete?.nombre}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
