import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { History, CheckCircle, AlertCircle } from 'lucide-react'
import Header from '../components/layout/Header'
import Badge from '../components/ui/Badge'
import { excelApi } from '../lib/api'
import { MESES } from '../types'
import { PageLoading } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function Importaciones() {
  const { data: importaciones = [], isLoading } = useQuery({
    queryKey: ['importaciones'],
    queryFn: () => excelApi.importaciones().then((r) => r.data),
  })

  if (isLoading) return <PageLoading />

  return (
    <div className="flex flex-col h-full">
      <Header title="Historial de Importaciones" subtitle={`${importaciones.length} importaciones registradas`} />

      <div className="flex-1 overflow-y-auto p-6">
        {importaciones.length === 0 ? (
          <EmptyState icon={History} title="Sin importaciones" description="No hay importaciones registradas." />
        ) : (
          <div className="space-y-3">
            {importaciones.map((imp) => (
              <div key={imp.id} className="card p-4 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      {imp.estado === 'COMPLETADO' ? (
                        <CheckCircle size={20} className="text-green-500" />
                      ) : (
                        <AlertCircle size={20} className="text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{imp.archivo_nombre}</p>
                      <p className="text-xs text-gray-500">
                        {imp.nomina_mensual?.servicio?.nombre} —{' '}
                        {MESES[(imp.nomina_mensual?.mes ?? 1) - 1]} {imp.nomina_mensual?.anio}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={imp.estado === 'COMPLETADO' ? 'success' : 'danger'}>
                      {imp.estado}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(imp.fecha_importacion), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{imp.total_filas}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{imp.agentes_creados}</p>
                    <p className="text-xs text-gray-500">Nuevos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{imp.agentes_actualizados}</p>
                    <p className="text-xs text-gray-500">Actualizados</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">{imp.agentes_no_presentes}</p>
                    <p className="text-xs text-gray-500">No presentes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">{imp.errores}</p>
                    <p className="text-xs text-gray-500">Errores</p>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  Importado por: <span className="font-medium">{imp.usuario?.nombre}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
