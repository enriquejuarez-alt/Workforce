import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Trash2, ChevronRight, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { programacionApi, serviciosApi } from '../lib/api'
import Header from '../components/layout/Header'
import { PageLoading } from '../components/ui/LoadingSpinner'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { MESES } from '../types'
import type { ProgramacionMensual } from '../types'
import { useAuthStore } from '../store/auth'

const SEMANA_LABELS: Record<number, string> = {
  0: 'Mes completo',
  1: 'Semana 1 (días 1–7)',
  2: 'Semana 2 (días 8–14)',
  3: 'Semana 3 (días 15–21)',
  4: 'Semana 4 (días 22–fin)',
}

const now = new Date()

export default function Programacion() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProgramacionMensual | null>(null)
  const [filterServicio, setFilterServicio] = useState('')
  const [filterAnio, setFilterAnio] = useState(now.getFullYear())
  const [form, setForm] = useState({
    servicio_id: '',
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
    semana: 0,
  })

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then(r => r.data.filter(s => s.activo)),
  })

  const { data: programaciones = [], isLoading } = useQuery({
    queryKey: ['programaciones', filterServicio, filterAnio],
    queryFn: () => programacionApi.list({
      servicioId: filterServicio ? parseInt(filterServicio) : undefined,
      anio: filterAnio,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: () => programacionApi.create({
      servicio_id: parseInt(form.servicio_id),
      mes: form.mes,
      anio: form.anio,
      semana: form.semana,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['programaciones'] })
      setShowForm(false)
      navigate(`/programacion/${res.data.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => programacionApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programaciones'] }),
  })

  function handleDelete(prog: ProgramacionMensual, e: React.MouseEvent) {
    e.stopPropagation()
    setPendingDelete(prog)
  }

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1]

  if (isLoading) return <PageLoading text="Cargando programaciones..." />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Programación"
        subtitle="Simulación de cobertura de agentes por período"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Nueva programación
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="input-base w-48"
            value={filterServicio}
            onChange={e => setFilterServicio(e.target.value)}
          >
            <option value="">Todos los servicios</option>
            {servicios.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          <select
            className="input-base w-32"
            value={filterAnio}
            onChange={e => setFilterAnio(parseInt(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{programaciones.length} programaciones</span>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h3 className="text-base font-bold text-gray-900 mb-5">Nueva programación</h3>
              <div className="space-y-4">
                <div>
                  <label className="label-base">Servicio</label>
                  <select
                    className="input-base w-full"
                    value={form.servicio_id}
                    onChange={e => setForm(f => ({ ...f, servicio_id: e.target.value }))}
                  >
                    <option value="">Seleccionar servicio…</option>
                    {servicios.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-base">Mes</label>
                    <select
                      className="input-base w-full"
                      value={form.mes}
                      onChange={e => setForm(f => ({ ...f, mes: parseInt(e.target.value) }))}
                    >
                      {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Año</label>
                    <select
                      className="input-base w-full"
                      value={form.anio}
                      onChange={e => setForm(f => ({ ...f, anio: parseInt(e.target.value) }))}
                    >
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label-base">Período</label>
                  <select
                    className="input-base w-full"
                    value={form.semana}
                    onChange={e => setForm(f => ({ ...f, semana: parseInt(e.target.value) }))}
                  >
                    {Object.entries(SEMANA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
                <button
                  className="btn-primary flex-1"
                  disabled={!form.servicio_id || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? 'Creando…' : 'Crear'}
                </button>
              </div>
              {createMut.isError && (
                <p className="text-xs text-red-600 mt-2 text-center">
                  {(createMut.error as any)?.response?.data?.error ?? 'Error al crear'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* List */}
        {programaciones.length === 0 ? (
          <div className="card p-12 text-center">
            <CalendarClock size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">Sin programaciones para este período</p>
            <p className="text-xs text-gray-400 mt-1">Creá una nueva para simular la cobertura de agentes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programaciones.map(prog => (
              <div
                key={prog.id}
                className="card p-5 cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(`/programacion/${prog.id}`)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: prog.servicio.color + '22' }}
                  >
                    <BarChart3 size={18} style={{ color: prog.servicio.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{prog.servicio.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {MESES[prog.mes - 1]} {prog.anio}
                      {prog.semana > 0 && <span className="ml-1 text-gray-400">· Sem {prog.semana}</span>}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold text-gray-700">{prog._count?.requeridos ?? 0}</span> requeridos
                  </span>
                  {prog.factor && (
                    <span className="text-gray-400">
                      reductor {((prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion) * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="ml-auto text-gray-300">
                    {format(new Date(prog.fecha_creacion), 'dd/MM/yy', { locale: es })}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    className="mt-3 flex items-center gap-1 text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => handleDelete(prog, e)}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) deleteMut.mutate(pendingDelete.id); setPendingDelete(null) }}
        title="Eliminar programación"
        message={pendingDelete ? `¿Eliminar programación de ${pendingDelete.servicio.nombre} — ${MESES[pendingDelete.mes - 1]} ${pendingDelete.anio}?` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
