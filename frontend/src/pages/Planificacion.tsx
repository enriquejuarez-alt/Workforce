import { useState } from 'react'
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react'
import Header from '../components/layout/Header'

const PLANI_URL = 'http://localhost:3000'

export default function Planificacion() {
  const [key, setKey] = useState(0)
  const [error, setError] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Planificación HC"
        subtitle="Dotación mensual — Konecta Soporte AR"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost py-1.5 px-3 text-sm"
              onClick={() => { setError(false); setKey((k) => k + 1) }}
              title="Recargar"
            >
              <RefreshCw size={14} />
            </button>
            <a
              href={PLANI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost py-1.5 px-3 text-sm flex items-center gap-1.5"
            >
              <ExternalLink size={14} /> Abrir en nueva pestaña
            </a>
          </div>
        }
      />

      <div className="flex-1 relative">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <BarChart3 size={28} className="text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">No se pudo cargar la planificación</p>
              <p className="text-sm text-gray-500 mb-4">
                Asegurate de que la app de planificación esté corriendo en{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{PLANI_URL}</code>
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Corré <code className="bg-gray-100 px-1.5 py-0.5 rounded">pnpm dev</code> en la carpeta{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">konecta-hc</code>
              </p>
            </div>
            <button className="btn-primary" onClick={() => { setError(false); setKey((k) => k + 1) }}>
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        ) : (
          <iframe
            key={key}
            src={PLANI_URL}
            className="w-full h-full border-0"
            title="Planificación HC"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  )
}
