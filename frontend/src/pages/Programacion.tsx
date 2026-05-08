import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Trash2, ChevronRight, BarChart3, Users, Hash, X } from 'lucide-react'
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
const SEMANA_SHORT: Record<number, string> = {
  0: 'Mes completo', 1: 'Sem 1', 2: 'Sem 2', 3: 'Sem 3', 4: 'Sem 4',
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
  const servicioCount = new Set(programaciones.map(p => p.servicio_id)).size

  if (isLoading) return <PageLoading text="Cargando programaciones..." />

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Programación"
        subtitle={programaciones.length > 0
          ? `${programaciones.length} programaciones · ${servicioCount} ${servicioCount === 1 ? 'servicio' : 'servicios'}`
          : 'Simulación de cobertura de agentes por período'
        }
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Nueva programación
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <select
              className="text-sm text-gray-700 bg-transparent border-none outline-none"
              value={filterServicio}
              onChange={e => setFilterServicio(e.target.value)}
            >
              <option value="">Todos los servicios</option>
              {servicios.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setFilterAnio(y)}
                className={`px-3 py-2 text-sm font-semibold transition-colors ${
                  filterAnio === y ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Modal nueva programación */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Nueva programación</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
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
              {createMut.isError && (
                <p className="text-xs text-red-600 mt-3 text-center">
                  {(createMut.error as any)?.response?.data?.error ?? 'Error al crear'}
                </p>
              )}
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
            </div>
          </div>
        )}

        {/* Lista */}
        {programaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
              <CalendarClock size={36} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-500">Sin programaciones para este período</p>
            <p className="text-sm text-gray-400">Creá una nueva para simular la cobertura de agentes</p>
            <button className="btn-primary mt-2" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Nueva programación
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {programaciones.map(prog => {
              const totalReduccion = prog.factor
                ? prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion
                : null
              return (
                <div
                  key={prog.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group overflow-hidden"
                  onClick={() => navigate(`/programacion/${prog.id}`)}
                >
                  {/* Barra de color del servicio */}
                  <div className="h-1.5" style={{ backgroundColor: prog.servicio.color }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: prog.servicio.color + '20' }}
                        >
                          <BarChart3 size={16} style={{ color: prog.servicio.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{prog.servicio.nombre}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500 font-medium">
                              {MESES[prog.mes - 1]} {prog.anio}
                            </span>
                            {prog.semana > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-semibold">
                                {SEMANA_SHORT[prog.semana]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-gray-900">{prog._count?.requeridos ?? 0}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">franjas</p>
                      </div>
                      {prog.nomina ? (
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-bold text-green-700">
                            {MESES[prog.nomina.mes - 1].slice(0, 3)} {prog.nomina.anio}
                          </p>
                          <p className="text-[10px] text-green-500 mt-0.5 font-medium">
                            {prog.nomina.total_agentes} agentes
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-gray-400">
                            <Users size={11} />
                            <span className="text-[10px] font-medium">Activos</span>
                          </div>
                          <p className="text-[10px] text-gray-300 mt-0.5">sin nómina</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      {totalReduccion !== null ? (
                        <span className="flex items-center gap-1">
                          <Hash size={9} />
                          Reductor <strong className="text-gray-600">{(totalReduccion * 100).toFixed(0)}%</strong>
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">Sin factor</span>
                      )}
                      <span>{format(new Date(prog.fecha_creacion), 'dd/MM/yy', { locale: es })}</span>
                    </div>

                    {isAdmin && (
                      <button
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all py-1 hover:bg-red-50 rounded-lg"
                        onClick={e => handleDelete(prog, e)}
                      >
                        <Trash2 size={10} /> Eliminar programación
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
