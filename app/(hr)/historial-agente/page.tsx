"use client";

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, X, ChevronLeft, ChevronRight, Download, SlidersHorizontal, GitCommitVertical,
  Upload, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '@/components/hr/layout/Header'
import Modal from '@/components/hr/ui/Modal'
import { agentesApi, serviciosApi, historialServicioImportApi } from '@/lib/api'
import { EstadoAgenteBadge } from '@/components/hr/ui/Badge'
import EmptyState from '@/components/hr/ui/EmptyState'
import { SkeletonTable } from '@/components/hr/ui/Skeleton'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useAuthStore } from '@/store/auth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const LIMIT = 50

export default function HistorialAgentesListado() {
  const router = useRouter()
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.rol)
  const puedeImportar = rol === 'ADMINISTRADOR' || rol === 'WORKFORCE'
  const [showImport, setShowImport] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 350)
  const [servicioId, setServicioId] = useState('')
  const [servicioAnteriorId, setServicioAnteriorId] = useState('')
  const [estado, setEstado] = useState('')
  const [modalidad, setModalidad] = useState('')
  const [activo, setActivo] = useState('')
  const [tieneCapacitaciones, setTieneCapacitaciones] = useState(false)
  const [tieneRemociones, setTieneRemociones] = useState(false)
  const [edadMin, setEdadMin] = useState('')
  const [edadMax, setEdadMax] = useState('')
  const [fechaIngresoDesde, setFechaIngresoDesde] = useState('')
  const [fechaIngresoHasta, setFechaIngresoHasta] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const params: Record<string, any> = { page, limit: LIMIT }
  if (search) params.search = search
  if (servicioId) params.servicio_id = servicioId
  if (servicioAnteriorId) params.servicio_anterior_id = servicioAnteriorId
  if (estado) params.estado = estado
  if (modalidad) params.modalidad = modalidad
  if (activo) params.activo = activo
  if (tieneCapacitaciones) params.tiene_capacitaciones = 'true'
  if (tieneRemociones) params.tiene_remociones = 'true'
  if (edadMin) params.edad_min = edadMin
  if (edadMax) params.edad_max = edadMax
  if (fechaIngresoDesde) params.fecha_ingreso_desde = fechaIngresoDesde
  if (fechaIngresoHasta) params.fecha_ingreso_hasta = fechaIngresoHasta

  const { data, isLoading } = useQuery({
    queryKey: ['historial-agentes', params],
    queryFn: () => agentesApi.list(params).then((r) => r.data),
  })

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const agentes = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const hayFiltros = !!(search || servicioId || servicioAnteriorId || estado || modalidad || activo ||
    tieneCapacitaciones || tieneRemociones || edadMin || edadMax || fechaIngresoDesde || fechaIngresoHasta)

  function limpiarFiltros() {
    setSearchInput('')
    setServicioId('')
    setServicioAnteriorId('')
    setEstado('')
    setModalidad('')
    setActivo('')
    setTieneCapacitaciones(false)
    setTieneRemociones(false)
    setEdadMin('')
    setEdadMax('')
    setFechaIngresoDesde('')
    setFechaIngresoHasta('')
    setPage(1)
  }

  function updateFiltro<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await agentesApi.exportExcel(params)
      const url = URL.createObjectURL(new Blob([res.data as any]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'historial_agentes.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Historial de Agentes"
        subtitle="Ficha histórica centralizada por agente"
        actions={
          <div className="flex items-center gap-2">
            {puedeImportar && (
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                <Upload size={14} /> Importar histórico
              </button>
            )}
            <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Buscador + filtros */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input-base pl-8"
                placeholder="Buscar por nombre o DNI..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
              />
              {searchInput && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => { setSearchInput(''); setPage(1) }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <select className="input-base w-44" value={servicioId} onChange={(e) => updateFiltro(setServicioId)(e.target.value)}>
              <option value="">Servicio actual</option>
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select className="input-base w-44" value={servicioAnteriorId} onChange={(e) => updateFiltro(setServicioAnteriorId)(e.target.value)}>
              <option value="">Servicio anterior</option>
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select className="input-base w-36" value={estado} onChange={(e) => updateFiltro(setEstado)(e.target.value)}>
              <option value="">Estado</option>
              <option value="ACTIVO">Activo</option>
              <option value="LP">Licencia</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <select className="input-base w-36" value={modalidad} onChange={(e) => updateFiltro(setModalidad)(e.target.value)}>
              <option value="">Modalidad</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="REMOTO">Remoto</option>
              <option value="HIBRIDO">Híbrido</option>
            </select>
            <select className="input-base w-36" value={activo} onChange={(e) => updateFiltro(setActivo)(e.target.value)}>
              <option value="">Activos e inactivos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={tieneCapacitaciones} onChange={(e) => updateFiltro(setTieneCapacitaciones)(e.target.checked)} />
              Con capacitaciones
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={tieneRemociones} onChange={(e) => updateFiltro(setTieneRemociones)(e.target.checked)} />
              Con remociones
            </label>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <SlidersHorizontal size={12} /> Edad
              <input type="number" className="input-base w-16 py-1" placeholder="Min" value={edadMin} onChange={(e) => updateFiltro(setEdadMin)(e.target.value)} />
              <span>-</span>
              <input type="number" className="input-base w-16 py-1" placeholder="Max" value={edadMax} onChange={(e) => updateFiltro(setEdadMax)(e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              Ingreso
              <input type="date" className="input-base w-36 py-1" value={fechaIngresoDesde} onChange={(e) => updateFiltro(setFechaIngresoDesde)(e.target.value)} />
              <span>-</span>
              <input type="date" className="input-base w-36 py-1" value={fechaIngresoHasta} onChange={(e) => updateFiltro(setFechaIngresoHasta)(e.target.value)} />
            </div>
            {hayFiltros && (
              <button className="text-xs font-semibold text-gray-400 hover:text-gray-600 ml-auto" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <SkeletonTable rows={10} cols={9} />
        ) : agentes.length === 0 ? (
          <EmptyState
            icon={GitCommitVertical}
            title="Sin agentes"
            description={hayFiltros ? 'No hay resultados con los filtros aplicados.' : 'Todavía no hay agentes cargados.'}
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">DNI</th>
                  <th className="table-th">Nombre completo</th>
                  <th className="table-th">Edad</th>
                  <th className="table-th">Servicio actual</th>
                  <th className="table-th">Modalidad</th>
                  <th className="table-th">Superior</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Fecha de ingreso</th>
                  <th className="table-th">Última actualización</th>
                </tr>
              </thead>
              <tbody>
                {agentes.map((a) => (
                  <tr
                    key={a.id}
                    className="table-tr cursor-pointer"
                    onClick={() => router.push(`/historial-agente/${a.id}`)}
                  >
                    <td className="table-td text-xs text-gray-600">{a.dni}</td>
                    <td className="table-td font-semibold text-gray-800 text-sm">{a.nombre}</td>
                    <td className="table-td text-xs">{a.edad ?? '—'}</td>
                    <td className="table-td text-xs">{a.servicio?.nombre || '—'}</td>
                    <td className="table-td text-xs">{a.modalidad || '—'}</td>
                    <td className="table-td text-xs">{a.superior || '—'}</td>
                    <td className="table-td"><EstadoAgenteBadge estado={a.estado} /></td>
                    <td className="table-td text-xs">{format(new Date(a.fecha_creacion), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="table-td text-xs">{format(new Date(a.fecha_actualizacion), 'dd/MM/yyyy', { locale: es })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">{total} registros · Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button className="btn-secondary py-1 px-3 flex items-center gap-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button className="btn-secondary py-1 px-3 flex items-center gap-1" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showImport && (
        <ImportHistorialModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['historial-agentes'] })
          }}
        />
      )}
    </div>
  )
}

function ImportHistorialModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof historialServicioImportApi.validar>>['data'] | null>(null)
  const [resultado, setResultado] = useState<{ agentes_creados: number; transiciones_servicio_creadas: number; transiciones_superior_creadas: number } | null>(null)

  const validarMut = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return historialServicioImportApi.validar(fd).then((r) => r.data)
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al procesar el archivo'),
  })

  const confirmarMut = useMutation({
    mutationFn: (token: string) => historialServicioImportApi.confirmar(token).then((r) => r.data),
    onSuccess: (data) => {
      setResultado({
        agentes_creados: data.agentes_creados,
        transiciones_servicio_creadas: data.transiciones_servicio_creadas,
        transiciones_superior_creadas: data.transiciones_superior_creadas,
      })
      toast.success('Importación confirmada')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al confirmar la importación'),
  })

  function handleFile(f: File) {
    setFile(f)
    setPreview(null)
    validarMut.mutate(f)
  }

  return (
    <Modal
      isOpen
      title="Importar histórico de servicios"
      onClose={onClose}
      size="lg"
      footer={
        resultado ? (
          <button className="btn-primary" onClick={onDone}>Cerrar</button>
        ) : preview ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={() => confirmarMut.mutate(preview.token)} disabled={confirmarMut.isPending}>
              {confirmarMut.isPending ? 'Confirmando...' : 'Confirmar importación'}
            </button>
          </>
        ) : (
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        )
      }
    >
      {resultado ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-green-700">Importación completada</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.agentes_creados}</p>
              <p className="text-xs text-gray-500 mt-0.5">Agentes creados</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.transiciones_servicio_creadas}</p>
              <p className="text-xs text-gray-500 mt-0.5">Transiciones de servicio</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.transiciones_superior_creadas}</p>
              <p className="text-xs text-gray-500 mt-0.5">Transiciones de superior</p>
            </div>
          </div>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Archivo desde {preview.fecha_desde_archivo} hasta {preview.fecha_hasta_archivo} · {preview.agentes_en_archivo} agentes.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{preview.agentes_ya_existentes}</p>
              <p className="text-xs text-gray-500 mt-0.5">Agentes ya existentes</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{preview.agentes_a_crear}</p>
              <p className="text-xs text-yellow-600 mt-0.5">Agentes nuevos a crear</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{preview.transiciones_servicio_nuevas}</p>
              <p className="text-xs text-gray-500 mt-0.5">Transiciones de servicio nuevas</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{preview.transiciones_superior_nuevas}</p>
              <p className="text-xs text-gray-500 mt-0.5">Transiciones de superior nuevas</p>
            </div>
          </div>
          {preview.areas_sin_mapeo.length > 0 && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>Áreas sin mapeo a un servicio (quedarán sin servicio asignado): {preview.areas_sin_mapeo.join(', ')}</p>
            </div>
          )}
          {preview.agentes_a_crear > 0 && (
            <div className="text-xs text-gray-500">
              <p className="font-semibold text-gray-600 mb-1">Muestra de agentes que se crearán:</p>
              <ul className="space-y-0.5 max-h-32 overflow-auto">
                {preview.muestra_agentes_a_crear.map((a) => (
                  <li key={a.dni}>{a.nombre} — DNI {a.dni}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            El archivo debe ser el export de histórico de servicios (CSV separado por “;”, con columnas
            fecha_maestro/documento/area_nombre/servicio_nombre/Superior_Nivel_1). Puede pesar varios cientos
            de MB — el análisis puede tardar un rato.
          </div>
          <div>
            <label className="label-base">Archivo CSV</label>
            <div
              className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-konecta transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {validarMut.isPending ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-konecta" />
                  <span className="text-sm font-medium text-gray-700">Analizando archivo...</span>
                </div>
              ) : file ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} className="text-konecta" />
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Clic para seleccionar archivo</p>
                  <p className="text-xs text-gray-400 mt-1">.csv</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
