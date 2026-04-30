import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react'

const PLANI_BASE = 'http://localhost:3000'

const PAGE_MAP: Record<string, string> = {
  carga:       '/',
  dashboard:   '/dashboard',
  analisis:    '/analisis',
  curvas:      '/curvas',
  simulador:   '/simulador',
  calculadora: '/calculadora',
}

export default function Planificacion() {
  const location = useLocation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState(false)

  const searchParams = new URLSearchParams(location.search)
  const page = searchParams.get('page') ?? 'carga'
  const path = PAGE_MAP[page] ?? '/'
  const iframeSrc = `${PLANI_BASE}${path}?embedded=1`

  // When the page param changes, navigate the iframe instead of reloading it
  // (preserves state when switching between Walt tabs)
  const prevPage = useRef(page)
  useEffect(() => {
    if (prevPage.current === page) return
    prevPage.current = page
    setError(false)
    try {
      iframeRef.current?.contentWindow?.location.replace(`${path}?embedded=1`)
    } catch {
      // cross-origin reload fallback — shouldn't happen on localhost
      iframeRef.current?.setAttribute('src', iframeSrc)
    }
  }, [page, path, iframeSrc])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Slim toolbar — replaces the full Header for Walt */}
      <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <span className="text-sm font-semibold text-gray-700">
          Walt · <span className="text-gray-400 font-normal capitalize">{page}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost py-1 px-2.5 text-xs"
            onClick={() => { setError(false); iframeRef.current?.setAttribute('src', iframeSrc) }}
            title="Recargar"
          >
            <RefreshCw size={13} />
          </button>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Nueva pestaña</span>
          </a>
        </div>
      </div>

      <div className="flex-1 relative bg-[#F8F9FA]">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <BarChart3 size={28} className="text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">No se pudo cargar Walt</p>
              <p className="text-sm text-gray-500 mb-4">
                Asegurate de que la app esté corriendo en{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{PLANI_BASE}</code>
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Corré <code className="bg-gray-100 px-1.5 py-0.5 rounded">pnpm dev</code> en la carpeta{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">konecta-hc</code>
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => { setError(false); iframeRef.current?.setAttribute('src', iframeSrc) }}
            >
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0"
            title="Walt — Planificación HC"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  )
}
