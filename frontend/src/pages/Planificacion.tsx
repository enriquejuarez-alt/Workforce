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
}

function buildSrc(page: string) {
  return `${PLANI_BASE}${PAGE_MAP[page] ?? '/'}?embedded=1`
}

export default function Planificacion() {
  const location = useLocation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState(false)

  const searchParams = new URLSearchParams(location.search)
  const page = searchParams.get('page') ?? 'carga'

  // Fixed src: only used on mount — never changes reactively.
  // Changing the src prop causes a full iframe reload which races with
  // the embedded detection in AppShell. Navigation after mount uses
  // contentWindow.location.replace (allowed cross-origin).
  const initialSrc = useRef(buildSrc(page))

  const prevPage = useRef<string | null>(null)

  useEffect(() => {
    // First mount: iframe already loaded the right page via initialSrc
    if (prevPage.current === null) {
      prevPage.current = page
      return
    }
    if (prevPage.current === page) return
    prevPage.current = page
    setError(false)

    // location.replace is allowed for cross-origin iframes (write-only access)
    iframeRef.current?.contentWindow?.location.replace(buildSrc(page))
  }, [page])

  const currentSrc = buildSrc(page)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <span className="text-sm font-semibold text-gray-700">
          Walt · <span className="text-gray-400 font-normal capitalize">{page}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost py-1 px-2.5 text-xs"
            onClick={() => { setError(false); iframeRef.current?.setAttribute('src', currentSrc) }}
            title="Recargar"
          >
            <RefreshCw size={13} />
          </button>
          <a
            href={currentSrc}
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
              onClick={() => { setError(false); iframeRef.current?.setAttribute('src', currentSrc) }}
            >
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={initialSrc.current}
            className="w-full h-full border-0"
            title="Walt — Planificación HC"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  )
}
