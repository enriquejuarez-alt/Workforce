import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState, type RowSelectionState,
} from '@tanstack/react-table'
import {
  Filter, Download, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, Edit2, Eye, Lock, SortAsc, SortDesc, X,
  RefreshCw, FileText, Users, Upload, Copy, Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { nominasApi, serviciosApi, exportApi } from '../lib/api'
import type { AgenteNominaMensual, NominaMensual, Servicio } from '../types'
import { MESES, ESTADO_NOMINA_LABELS } from '../types'
import Header from '../components/layout/Header'
import { NominaEstadoBadge, EstadoAgenteBadge, LicenciaBadge, CambioTemporalBadge, VacacionBadge } from '../components/ui/Badge'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EditAgentModal from '../components/agents/EditAgentModal'
import LicenciaModal from '../components/agents/LicenciaModal'
import CambioTemporalModal from '../components/agents/CambioTemporalModal'
import { usePermissions } from '../hooks/usePermissions'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

function fmtHorario(val: string | null | undefined): string {
  if (!val) return '—'
  const n = parseFloat(val)
  if (!isNaN(n) && n > 0 && n < 1) {
    const s = Math.round(n * 86400)
    const h = Math.floor(s / 3600) % 24
    const m = Math.floor((s % 3600) / 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return val
}

export default function Nomina() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAdmin, canEdit, canExport, canRegisterLicencia, canRegisterCambio } = usePermissions()

  // URL-persisted filters
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedServicioId: number | '' = (() => { const s = searchParams.get('svc'); return s ? parseInt(s) : '' })()
  const selectedMes = Number(searchParams.get('mes')) || currentMonth
  const selectedAnio = Number(searchParams.get('anio')) || currentYear

  const selectedTipo = searchParams.get('tipo') || 'OPERACION'

  const setSelectedServicioId = (id: number | '') =>
    setSearchParams((p) => { const n = new URLSearchParams(p); id ? n.set('svc', String(id)) : n.delete('svc'); return n }, { replace: true })
  const setSelectedMes = (mes: number) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('mes', String(mes)); return n }, { replace: true })
  const setSelectedAnio = (anio: number) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('anio', String(anio)); return n }, { replace: true })
  const setSelectedTipo = (tipo: string) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tipo', tipo); return n }, { replace: true })
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [editAgent, setEditAgent] = useState<AgenteNominaMensual | null>(null)
  const [licenciaAgent, setLicenciaAgent] = useState<AgenteNominaMensual | null>(null)
  const [cambioAgent, setCambioAgent] = useState<AgenteNominaMensual | null>(null)
  const [showDeleteNomina, setShowDeleteNomina] = useState(false)
  const [pendingDeleteAgente, setPendingDeleteAgente] = useState<{ id: number; nombre: string } | null>(null)
  const [showReplicar, setShowReplicar] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  // Reset filters, selection and sorting when switching services or tipo
  useEffect(() => {
    setFilters({})
    setRowSelection({})
    setSorting([])
  }, [selectedServicioId, selectedTipo])

  // Pre-compute as a stable boolean so `columns` useMemo doesn't recompute on every render.
  // canRegisterLicencia is recreated each render (no useCallback in hook), putting it directly
  // in deps would cause columns + table to recompute for every state change.
  const canRegLicencia = useMemo(
    () => (selectedServicioId ? canRegisterLicencia(selectedServicioId as number) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedServicioId, isAdmin],
  )

  // Refs let `columns` useMemo stay stable (empty deps) while cells always read fresh values.
  // Without this, nominaEditable changing on every nómina load forces a full table rebuild (O(n)).
  const nominaEditableRef = useRef(false)
  const canRegLicenciaRef = useRef(false)
  const selectedServicioIdRef = useRef<number | ''>('')

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const { data: nominas = [], isLoading: loadingNominas } = useQuery({
    queryKey: ['nominas', selectedServicioId, selectedMes, selectedAnio, selectedTipo],
    queryFn: () =>
      nominasApi.list({
        servicio_id: selectedServicioId || undefined,
        mes: selectedMes,
        anio: selectedAnio,
        tipo: selectedTipo,
      }).then((r) => r.data),
    enabled: !!selectedServicioId,
    staleTime: 30_000,
  })

  const nomina = nominas.find(
    (n) => n.servicio_id === selectedServicioId && n.mes === selectedMes && n.anio === selectedAnio && n.tipo === selectedTipo
  ) as NominaMensual | undefined

  const isCurrentMonth = selectedMes === currentMonth && selectedAnio === currentYear
  const canEditNomina = nomina && selectedServicioId
    ? canEdit(selectedServicioId as number, isCurrentMonth)
    : false
  const nominaEditable = canEditNomina && nomina?.estado !== 'CERRADA' && nomina?.estado !== 'ARCHIVADA'

  // Keep refs in sync every render so cell closures always read current values
  nominaEditableRef.current = nominaEditable
  canRegLicenciaRef.current = canRegLicencia
  selectedServicioIdRef.current = selectedServicioId

  const { data: agentes = [], isLoading: loadingAgentes, refetch } = useQuery({
    queryKey: ['nomina-agentes', nomina?.id, filters],
    queryFn: () => nominasApi.agentes(nomina!.id, filters).then((r) => r.data),
    enabled: !!nomina?.id,
    staleTime: 30_000,
  })

  const replicarMutation = useMutation({
    mutationFn: () => nominasApi.replicar(nomina!.id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries({ queryKey: ['nominas'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al replicar nómina')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (snapshotId: number) => nominasApi.deleteAgente(snapshotId),
    onSuccess: () => {
      toast.success('Agente eliminado de la nómina')
      qc.invalidateQueries({ queryKey: ['nomina-agentes'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al eliminar agente')
    },
  })

  const handleDeleteAgente = useCallback((snapshotId: number, nombre: string) => {
    setPendingDeleteAgente({ id: snapshotId, nombre })
  }, [])

  const deleteNominaMutation = useMutation({
    mutationFn: () => nominasApi.delete(nomina!.id),
    onSuccess: () => {
      toast.success('Nómina eliminada')
      qc.invalidateQueries({ queryKey: ['nominas'] })
      setShowDeleteNomina(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al eliminar nómina'),
  })

  const handleExport = async () => {
    if (!nomina) return
    try {
      const res = await exportApi.nomina(nomina.id)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `nomina_${nomina.id}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exportación completada')
    } catch {
      toast.error('Error al exportar')
    }
  }

  const handleBulkExport = useCallback(() => {
    const selectedIds = new Set(Object.keys(rowSelection))
    const selected = agentes.filter((a) => selectedIds.has(String(a.id)))
    const headers = ['Nombre', 'DNI', 'Usuario', 'Superior', 'Segmento', 'Estado', 'Contrato', 'Modalidad', 'Sitio']
    const rows = selected.map((a) =>
      [a.nombre, a.dni, a.usuario, a.superior, a.segmento, a.estado, a.contrato, a.modalidad, a.sitio]
        .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = '﻿' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentes_${selected.length}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${selected.length} agentes exportados`)
  }, [rowSelection, agentes])

  const handleBulkDeleteConfirm = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number)
    try {
      await Promise.all(ids.map((id) => nominasApi.deleteAgente(id)))
      toast.success(`${ids.length} agentes eliminados`)
      setRowSelection({})
      qc.invalidateQueries({ queryKey: ['nomina-agentes'] })
    } catch {
      toast.error('Error al eliminar algunos agentes')
    }
    setShowBulkDelete(false)
  }, [rowSelection, qc])

  const columns = useMemo<ColumnDef<AgenteNominaMensual>[]>(() => [
    {
      id: 'select',
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded cursor-pointer accent-konecta"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded cursor-pointer accent-konecta"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      header: 'Agente',
      accessorFn: (r) => r.nombre,
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-gray-800 text-sm">{row.original.nombre}</p>
          <p className="text-xs text-gray-400">{row.original.usuario} · DNI {row.original.dni}</p>
        </div>
      ),
    },
    { header: 'Superior', accessorKey: 'superior', cell: ({ getValue }) => <span className="text-xs">{getValue() as string || '—'}</span> },
    { header: 'Segmento', accessorKey: 'segmento', cell: ({ getValue }) => <span className="text-xs">{getValue() as string || '—'}</span> },
    { header: 'Horarios', accessorKey: 'horarios', cell: ({ getValue }) => <span className="text-xs font-mono">{fmtHorario(getValue() as string)}</span> },
    {
      header: 'Estado',
      accessorKey: 'estado',
      cell: ({ getValue }) => <EstadoAgenteBadge estado={getValue() as string} />,
    },
    { header: 'Contrato', accessorKey: 'contrato', cell: ({ getValue }) => <span className="text-xs">{getValue() as string || '—'}</span> },
    { header: 'Modalidad', accessorKey: 'modalidad', cell: ({ getValue }) => <span className="text-xs">{getValue() as string || '—'}</span> },
    { header: 'Sitio', accessorKey: 'sitio', cell: ({ getValue }) => <span className="text-xs">{getValue() as string || '—'}</span> },
    {
      header: 'Situación',
      id: 'situacion',
      cell: ({ row }) => {
        const licencia = row.original.agente?.licencias?.[0]
        const cambio = row.original.agente?.cambios_temporales?.[0]
        const vacacion = row.original.agente?.vacaciones?.[0]
        const noPresente = !row.original.presente_en_nomina
        const now = new Date()
        const tipoLicencia = licencia
          ? new Date(licencia.fecha_desde) > now ? 'PROGRAMADA' as const
            : new Date(licencia.fecha_hasta) < now ? 'FINALIZADA' as const
            : 'VIGENTE' as const
          : null
        const tipoVacacion = vacacion
          ? new Date(vacacion.fecha_desde) > now ? 'PROGRAMADA' as const
            : new Date(vacacion.fecha_hasta) < now ? 'FINALIZADA' as const
            : 'VIGENTE' as const
          : null
        return (
          <div className="flex flex-col gap-1">
            {licencia && tipoLicencia && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <LicenciaBadge tipo={tipoLicencia} />
                <span className="text-xs text-gray-400">hasta {format(new Date(licencia.fecha_hasta), 'dd/MM/yy')}</span>
              </div>
            )}
            {vacacion && tipoVacacion && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <VacacionBadge tipo={tipoVacacion} />
                <span className="text-xs text-gray-400">hasta {format(new Date(vacacion.fecha_hasta), 'dd/MM/yy')}</span>
              </div>
            )}
            {cambio && <CambioTemporalBadge servicio={cambio.servicio_temporal?.nombre} />}
            {noPresente && <span className="text-xs text-red-500 font-medium">No presente</span>}
          </div>
        )
      },
    },
    {
      header: 'Acciones',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/nomina/agente/${row.original.agente_id}`)}
            className="btn-ghost px-2 py-1 text-xs"
            title="Ver detalle"
          >
            <Eye size={13} />
          </button>
          {nominaEditableRef.current && (
            <button
              onClick={() => setEditAgent(row.original)}
              className="btn-ghost px-2 py-1 text-xs text-konecta"
              title="Editar"
            >
              <Edit2 size={13} />
            </button>
          )}
          {selectedServicioIdRef.current && canRegLicenciaRef.current && (
            <button
              onClick={() => setLicenciaAgent(row.original)}
              className="btn-ghost px-2 py-1 text-xs"
              title="Registrar licencia"
            >
              <FileText size={13} />
            </button>
          )}
          {nominaEditableRef.current && (
            <button
              onClick={() => handleDeleteAgente(row.original.id, row.original.nombre)}
              className="btn-ghost px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              title="Eliminar de la nómina"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  // navigate y handleDeleteAgente son siempre estables → columns NUNCA se reconstruye
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, handleDeleteAgente])

  const table = useReactTable({
    data: agentes,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const filterCount = Object.values(filters).filter(Boolean).length

  const filterOptions = useMemo(() => ({
    superior: [...new Set(agentes.map((a) => a.superior).filter(Boolean) as string[])].sort(),
    segmento: [...new Set(agentes.map((a) => a.segmento).filter(Boolean) as string[])].sort(),
    estado: [...new Set(agentes.map((a) => a.estado).filter(Boolean) as string[])].sort(),
    sitio: [...new Set(agentes.map((a) => a.sitio).filter(Boolean) as string[])].sort(),
    contrato: ['30 horas', '35 horas', '36 horas'],
    modalidad: ['Híbrida', 'Presencial', 'Home Office'],
  }), [agentes])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Nómina de Agentes"
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && selectedServicioId && (
              <button
                className="btn-secondary"
                onClick={() =>
                  navigate(`/carga?servicio_id=${selectedServicioId}&mes=${selectedMes}&anio=${selectedAnio}&formato=${selectedTipo === 'MEUCCI' ? 'meucci' : 'operacion'}`)
                }
              >
                <Upload size={14} /> Subir Excel
              </button>
            )}
            {isAdmin && nomina && (
              <button
                className="btn-secondary"
                onClick={() => {
                  const nextMes = selectedMes === 12 ? 1 : selectedMes + 1
                  const nextAnio = selectedMes === 12 ? selectedAnio + 1 : selectedAnio
                  setShowReplicar(true)
                }}
                disabled={replicarMutation.isPending}
              >
                <Copy size={14} />
                {replicarMutation.isPending ? 'Replicando...' : 'Replicar nómina'}
              </button>
            )}
            {nomina && selectedServicioId && canExport(selectedServicioId as number, !isCurrentMonth) && (
              <button className="btn-secondary" onClick={handleExport}>
                <Download size={14} /> Exportar
              </button>
            )}
            {isAdmin && nomina && (
              <button className="btn-ghost text-red-500 hover:bg-red-50" onClick={() => setShowDeleteNomina(true)}>
                <Trash2 size={14} /> Eliminar nómina
              </button>
            )}
            <button className="btn-ghost" onClick={() => refetch()}>
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
        {/* Selector de período */}
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label-base">Servicio</label>
              <select
                className="input-base w-52"
                value={selectedServicioId}
                onChange={(e) => setSelectedServicioId(e.target.value ? parseInt(e.target.value) : '')}
              >
                <option value="">Seleccionar servicio...</option>
                {servicios.filter((s) => s.activo).map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-base">Mes</label>
              <select className="input-base w-36" value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Año</label>
              <select className="input-base w-24" value={selectedAnio} onChange={(e) => setSelectedAnio(parseInt(e.target.value))}>
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {nomina && (
              <div className="flex items-center gap-3 ml-auto">
                <NominaEstadoBadge estado={nomina.estado} />
                {nominaEditable ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <Edit2 size={12} /> Editable
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                    <Lock size={12} /> Solo lectura
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Tipo selector */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedTipo === 'OPERACION' ? 'bg-konecta text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setSelectedTipo('OPERACION')}
            >
              Nómina Operación
            </button>
            <button
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedTipo === 'MEUCCI' ? 'bg-konecta text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setSelectedTipo('MEUCCI')}
            >
              Nómina Meucci
            </button>
          </div>
        </div>

        {!selectedServicioId ? (
          <EmptyState icon={Filter} title="Seleccioná un servicio" description="Elegí un servicio y período para visualizar la nómina." />
        ) : (loadingNominas || loadingAgentes) ? (
          <PageLoading text="Cargando nómina..." />
        ) : (
          <>
            {/* Filtros */}
            <div className="card p-3">
              <div className="flex items-center justify-between">
                <button
                  className="btn-ghost"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={14} />
                  Filtros
                  {filterCount > 0 && (
                    <span className="ml-1 bg-konecta text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {filterCount}
                    </span>
                  )}
                </button>
                <p className="text-xs text-gray-500">
                  Mostrando {table.getRowModel().rows.length} de {agentes.length} agentes
                </p>
                {filterCount > 0 && (
                  <button className="btn-ghost text-red-500" onClick={() => setFilters({})}>
                    <X size={12} /> Limpiar filtros
                  </button>
                )}
              </div>

              {showFilters && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <input
                    className="input-base text-xs col-span-2"
                    placeholder="Buscar nombre, DNI o usuario..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  />
                  <select
                    className="input-base text-xs"
                    value={filters.superior || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, superior: e.target.value }))}
                  >
                    <option value="">Todos los superiores</option>
                    {filterOptions.superior.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select
                    className="input-base text-xs"
                    value={filters.segmento || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, segmento: e.target.value }))}
                  >
                    <option value="">Todos los segmentos</option>
                    {filterOptions.segmento.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select
                    className="input-base text-xs"
                    value={filters.estado || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}
                  >
                    <option value="">Todos los estados</option>
                    {filterOptions.estado.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select
                    className="input-base text-xs"
                    value={filters.contrato || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, contrato: e.target.value }))}
                  >
                    <option value="">Todos los contratos</option>
                    {filterOptions.contrato.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select
                    className="input-base text-xs"
                    value={filters.modalidad || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, modalidad: e.target.value }))}
                  >
                    <option value="">Todas las modalidades</option>
                    {filterOptions.modalidad.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select
                    className="input-base text-xs"
                    value={filters.sitio || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, sitio: e.target.value }))}
                  >
                    <option value="">Todos los sitios</option>
                    {filterOptions.sitio.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={filters.no_presente === 'true'}
                      onChange={(e) => setFilters((f) => ({ ...f, no_presente: e.target.checked ? 'true' : '' }))}
                    />
                    Solo no presentes
                  </label>
                </div>
              )}
            </div>

            {/* Tabla */}
            <div className="card flex-1 overflow-hidden flex flex-col">
              {!nomina ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                  <EmptyState
                    icon={FileText}
                    title="Sin nómina para este período"
                    description={`No existe nómina ${selectedTipo === 'MEUCCI' ? 'Meucci' : 'de Operación'} para ${MESES[selectedMes - 1]} ${selectedAnio} en este servicio.`}
                  />
                  {isAdmin && (
                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(`/carga?servicio_id=${selectedServicioId}&mes=${selectedMes}&anio=${selectedAnio}`)
                      }
                    >
                      <Upload size={14} /> Subir Excel para este período
                    </button>
                  )}
                </div>
              ) : agentes.length === 0 ? (
                <EmptyState icon={Users} title="Sin agentes" description="No hay agentes en esta nómina." />
              ) : (
                <>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                        {table.getHeaderGroups().map((hg) => (
                          <tr key={hg.id}>
                            {hg.headers.map((h) => (
                              <th key={h.id} className="table-th cursor-pointer select-none"
                                onClick={h.column.getToggleSortingHandler()}
                              >
                                <div className="flex items-center gap-1">
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                  {h.column.getIsSorted() === 'asc' && <SortAsc size={11} />}
                                  {h.column.getIsSorted() === 'desc' && <SortDesc size={11} />}
                                </div>
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.map((row) => (
                          <tr key={row.id} className={`table-tr ${!row.original.presente_en_nomina ? 'bg-red-50/30' : ''}`}>
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="table-td">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost py-1" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                        <ChevronsLeft size={14} />
                      </button>
                      <button className="btn-ghost py-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs text-gray-600">
                        Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                      </span>
                      <button className="btn-ghost py-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        <ChevronRight size={14} />
                      </button>
                      <button className="btn-ghost py-1" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                    <select
                      className="input-base w-24 text-xs"
                      value={table.getState().pagination.pageSize}
                      onChange={(e) => table.setPageSize(parseInt(e.target.value))}
                    >
                      {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} / página</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {editAgent && nomina && (
        <EditAgentModal
          agent={editAgent}
          nomina={nomina}
          isOpen
          onClose={() => setEditAgent(null)}
          onSaved={() => { setEditAgent(null); qc.invalidateQueries({ queryKey: ['nomina-agentes'] }) }}
          segmentosDisponibles={filterOptions.segmento}
          estadosDisponibles={filterOptions.estado}
        />
      )}

      {licenciaAgent && (
        <LicenciaModal
          agente={licenciaAgent}
          isOpen
          onClose={() => setLicenciaAgent(null)}
          onSaved={() => { setLicenciaAgent(null); toast.success('Licencia registrada') }}
        />
      )}

      {cambioAgent && (
        <CambioTemporalModal
          agente={cambioAgent}
          servicios={servicios}
          isOpen
          onClose={() => setCambioAgent(null)}
          onSaved={() => { setCambioAgent(null); toast.success('Cambio temporal registrado') }}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteNomina}
        onClose={() => setShowDeleteNomina(false)}
        onConfirm={() => deleteNominaMutation.mutate()}
        title="Eliminar nómina"
        message={`¿Seguro querés eliminar la nómina de ${nomina ? `${MESES[nomina.mes - 1]} ${nomina.anio}` : ''}? Se eliminarán todos los agentes y registros asociados. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteNominaMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteAgente}
        onClose={() => setPendingDeleteAgente(null)}
        onConfirm={() => {
          if (pendingDeleteAgente) deleteMutation.mutate(pendingDeleteAgente.id)
          setPendingDeleteAgente(null)
        }}
        title="Eliminar agente de nómina"
        message={`¿Eliminar a ${pendingDeleteAgente?.nombre} de esta nómina? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {nomina && (() => {
        const nextMes = selectedMes === 12 ? 1 : selectedMes + 1
        const nextAnio = selectedMes === 12 ? selectedAnio + 1 : selectedAnio
        return (
          <ConfirmDialog
            isOpen={showReplicar}
            onClose={() => setShowReplicar(false)}
            onConfirm={() => { replicarMutation.mutate(); setShowReplicar(false) }}
            title="Replicar nómina"
            message={`¿Replicar nómina al mes siguiente? (${MESES[nextMes - 1]} ${nextAnio})\n\nSe copiarán ${nomina.total_agentes} agentes como borrador.`}
            confirmLabel="Replicar"
            variant="warning"
            loading={replicarMutation.isPending}
          />
        )
      })()}

      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Eliminar agentes seleccionados"
        message={`¿Eliminar ${Object.keys(rowSelection).length} agentes de esta nómina? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar todos"
        variant="danger"
      />

      {/* Bulk action bar */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto">
            <span className="text-sm font-semibold tabular-nums">
              {Object.keys(rowSelection).length} seleccionado{Object.keys(rowSelection).length !== 1 ? 's' : ''}
            </span>
            <span className="w-px h-4 bg-white/20" />
            <button
              onClick={handleBulkExport}
              className="flex items-center gap-1.5 text-sm hover:text-blue-300 transition-colors"
            >
              <Download size={14} /> Exportar CSV
            </button>
            {isAdmin && (
              <>
                <span className="w-px h-4 bg-white/20" />
                <button
                  onClick={() => setShowBulkDelete(true)}
                  className="flex items-center gap-1.5 text-sm hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </>
            )}
            <span className="w-px h-4 bg-white/20" />
            <button
              onClick={() => setRowSelection({})}
              className="text-white/50 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

