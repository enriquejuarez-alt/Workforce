import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Upload, CheckCircle, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import Dropzone from '../components/ui/Dropzone'
import { excelApi, serviciosApi } from '../lib/api'
import type { ExcelPreview } from '../types'
import { MESES } from '../types'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function CargaExcel() {
  const [searchParams] = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [servicioId, setServicioId] = useState(searchParams.get('servicio_id') || '')
  const [mes, setMes] = useState(parseInt(searchParams.get('mes') || String(currentMonth)))
  const [anio, setAnio] = useState(parseInt(searchParams.get('anio') || String(currentYear)))
  const [preview, setPreview] = useState<ExcelPreview | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [result, setResult] = useState<any>(null)

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const validateMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file!)
      fd.append('servicio_id', servicioId)
      fd.append('mes', String(mes))
      fd.append('anio', String(anio))
      return excelApi.validar(fd).then((r) => r.data)
    },
    onSuccess: (data) => {
      setPreview(data)
      setStep('preview')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al validar el archivo')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => excelApi.confirmar(preview!.token).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data)
      setStep('success')
      toast.success(data.message || 'Importación completada')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al confirmar importación')
    },
  })

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setStep('upload')
    setResult(null)
  }

  const servicio = servicios.find((s: any) => s.id === parseInt(servicioId))

  return (
    <div className="flex flex-col h-full">
      <Header title="Carga de Excel" subtitle="Importar nómina mensual desde archivo Excel" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: 'Configurar', active: step === 'upload' },
              { n: 2, label: 'Previsualizar', active: step === 'preview' },
              { n: 3, label: 'Completado', active: step === 'success' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${step !== 'upload' && i <= (step === 'success' ? 2 : 1) ? 'bg-konecta' : 'bg-gray-200'}`} />}
                <div className={`flex items-center gap-2 text-sm font-medium ${s.active ? 'text-konecta' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.active ? 'bg-konecta text-white' :
                    (step === 'success' && s.n < 3) || (step === 'preview' && s.n < 2) ? 'bg-green-500 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {((step === 'success' && s.n < 3) || (step === 'preview' && s.n < 2)) ? '✓' : s.n}
                  </div>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {step === 'upload' && (
            <>
              {/* Config */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-4">1. Configurar período</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3">
                    <label className="label-base">Servicio *</label>
                    <select className="input-base" value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
                      <option value="">Seleccionar servicio...</option>
                      {servicios.filter((s: any) => s.activo).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Mes *</label>
                    <select className="input-base" value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                      {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Año *</label>
                    <select className="input-base" value={anio} onChange={(e) => setAnio(parseInt(e.target.value))}>
                      {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* File upload */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-4">2. Subir archivo Excel</h3>
                <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} />
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Columnas requeridas en el Excel:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO', 'HORARIOS', 'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE'].map((c) => (
                      <span key={c} className={`px-2 py-0.5 rounded text-xs font-mono ${['DNI', 'USUARIO', 'NOMBRE'].includes(c) ? 'bg-konecta text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">En azul: columnas obligatorias</p>
                </div>
              </div>

              <button
                className="btn-primary w-full justify-center py-3"
                onClick={() => validateMutation.mutate()}
                disabled={!file || !servicioId || validateMutation.isPending}
              >
                <Upload size={16} />
                {validateMutation.isPending ? 'Validando archivo...' : 'Validar y previsualizar'}
              </button>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              {/* Stats */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800">Resumen de importación</h3>
                  <div className="text-xs text-gray-500">
                    {servicio?.nombre} — {MESES[mes - 1]} {anio}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3 text-center">
                  {[
                    { label: 'Total filas', value: preview.stats.total, color: 'text-gray-700' },
                    { label: 'Nuevos', value: preview.stats.nuevos, color: 'text-green-600' },
                    { label: 'Actualizados', value: preview.stats.actualizados, color: 'text-blue-600' },
                    { label: 'Con errores', value: preview.stats.errores, color: 'text-red-600' },
                    { label: 'No presentes', value: preview.stats.no_presentes, color: 'text-yellow-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {preview.errors.length > 0 && (
                <div className="card p-6 border-red-200">
                  <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} /> {preview.errors.length} filas con errores
                  </h3>
                  <div className="overflow-x-auto max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b"><th className="table-th">Fila</th><th className="table-th">Errores</th></tr></thead>
                      <tbody>
                        {preview.errors.map((e, i) => (
                          <tr key={i} className="table-tr">
                            <td className="table-td">{e.fila}</td>
                            <td className="table-td text-red-600">{e.errores?.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preview rows */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">
                  Vista previa ({Math.min(preview.rows.length, 100)} de {preview.total_rows} registros)
                </h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th className="table-th">DNI</th>
                        <th className="table-th">Usuario</th>
                        <th className="table-th">Nombre</th>
                        <th className="table-th">Estado</th>
                        <th className="table-th">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="table-tr">
                          <td className="table-td font-mono">{row.dni}</td>
                          <td className="table-td">{row.usuario}</td>
                          <td className="table-td">{row.nombre}</td>
                          <td className="table-td">{row.estado}</td>
                          <td className="table-td">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              row._status === 'NUEVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {row._status === 'NUEVO' ? 'Nuevo' : 'Actualizar'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="btn-secondary" onClick={handleReset}>
                  <X size={14} /> Cancelar y reiniciar
                </button>
                <button
                  className="btn-primary flex-1 justify-center py-3"
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                >
                  <CheckCircle size={16} />
                  {confirmMutation.isPending ? 'Importando...' : `Confirmar importación de ${preview.total_rows} agentes`}
                </button>
              </div>
            </>
          )}

          {step === 'success' && result && (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Importación completada!</h2>
              <p className="text-gray-600 mb-6">{result.message}</p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                  <p className="text-xs text-gray-500">Total importados</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-green-600">{result.creados}</p>
                  <p className="text-xs text-gray-500">Nuevos creados</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-blue-600">{result.actualizados}</p>
                  <p className="text-xs text-gray-500">Actualizados</p>
                </div>
              </div>
              <button className="btn-primary" onClick={handleReset}>
                <Upload size={14} /> Nueva importación
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
