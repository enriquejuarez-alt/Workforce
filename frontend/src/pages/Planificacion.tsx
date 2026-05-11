import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ExternalLink, RefreshCw, Download, ChevronDown } from 'lucide-react'
import { planiApi, serviciosApi } from '../lib/api'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const PLANI_BASE = 'http://localhost:3000'

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
]

const PAGE_MAP: Record<string, string> = {
  carga:     '/',
  dashboard: '/dashboard',
  analisis:  '/analisis',
  curvas:    '/curvas',
  simulador: '/simulador',
}

function buildSrc(page: string) {
  return `${PLANI_BASE}${PAGE_MAP[page] ?? '/'}?embedded=1`
}

export default function Planificacion() {
  const location = useLocation()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState(false)
  const [planiReady, setPlaniReady] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [showPeriod, setShowPeriod] = useState(false)

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [servicioId, setServicioId] = useState<number | ''>('')

  const { data: servicios = [] } = useQuery({
    queryKey: ['servicios'],
    queryFn: () => serviciosApi.list().then((r) => r.data),
  })

  const searchParams = new URLSearchParams(location.search)
  const page = searchParams.get('page') ?? 'carga'

  // El iframe siempre carga en la base — la navegación interna es via postMessage
  const initialSrc = useRef(`${PLANI_BASE}/?embedded=1`)

  // Send service config and listen for PLANI_READY / PLANI_PAGE_CHANGE
  useEffect(() => {
    async function sendInit() {
      try {
        const { data } = await planiApi.getConfig()
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'PLANI_INIT', servicios: data.servicios },
          PLANI_BASE
        )
      } catch {
        // Non-critical: Plali falls back to static config
      }
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== PLANI_BASE) return
      if (event.data?.type === 'PLANI_READY') {
        setPlaniReady(true)
        sendInit()
      }
      if (event.data?.type === 'PLANI_PAGE_CHANGE' && typeof event.data.page === 'string') {
        navigate(`/planificacion?page=${event.data.page}`)
      }
      if (event.data?.type === 'PLANI_REQUEST_NOMINA') {
        const { servicioId: sid, mes: m, anio: a } = event.data
        async function fetchAndSend() {
          try {
            const { data } = await planiApi.getNomina(m, a, sid || undefined)
            if (data.agentes.length === 0) {
              toast.error(`No hay nóminas activas para ese período`)
              return
            }
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'PLANI_NOMINA', agentes: data.agentes, mes: data.mes, anio: data.anio },
              PLANI_BASE
            )
            toast.success(`${data.agentes.length} agentes cargados en Walt`)
          } catch {
            toast.error('Error al obtener la nómina')
          }
        }
        fetchAndSend()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Navegar dentro del iframe via postMessage — sin recargar
  useEffect(() => {
    if (!planiReady) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PLANI_NAVIGATE', path: PAGE_MAP[page] ?? '/' },
      PLANI_BASE
    )
  }, [page, planiReady])

  const handleCargarEnWalt = async () => {
    if (!planiReady) {
      toast.error('Walt todavía no está listo, esperá un momento')
      return
    }
    setCargando(true)
    try {
      const { data } = await planiApi.getNomina(mes, anio, servicioId || undefined)
      if (data.agentes.length === 0) {
        toast.error(`No hay nóminas activas para ${MESES.find(m => m.value === mes)?.label} ${anio}`)
        return
      }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'PLANI_NOMINA', agentes: data.agentes, mes: data.mes, anio: data.anio },
        PLANI_BASE
      )
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'PLANI_NAVIGATE', path: '/' },
        PLANI_BASE
      )
      toast.success(`${data.agentes.length} agentes cargados en Walt`)
      setShowPeriod(false)
    } catch {
      toast.error('Error al cargar la nómina en Walt')
    } finally {
      setCargando(false)
    }
  }

  const currentSrc = buildSrc(page)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <span className="text-sm font-semibold text-gray-700">
          Walt · <span className="text-gray-400 font-normal capitalize">{page}</span>
        </span>

        <div className="flex items-center gap-1">
          {/* Cargar nómina */}
          <div className="relative">
            <button
              className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
              onClick={() => setShowPeriod((v) => !v)}
              title="Cargar nómina en Walt"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Cargar en Walt</span>
              <ChevronDown size={11} />
            </button>

            {showPeriod && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
                <p className="text-xs font-semibold text-gray-700 mb-3">Período a cargar</p>
                <div className="flex gap-2 mb-3">
                  <select
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                  >
                    {MESES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    value={anio}
                    min={2020}
                    max={2099}
                    onChange={(e) => setAnio(Number(e.target.value))}
                  />
                </div>
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Servicio</p>
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={servicioId}
                    onChange={(e) => setServicioId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Todos los servicios</option>
                    {(servicios as any[]).filter((s) => s.activo).map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-1.5"
                  onClick={handleCargarEnWalt}
                  disabled={cargando}
                >
                  {cargando ? 'Cargando…' : 'Enviar a Walt'}
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-ghost py-1 px-2.5 text-xs"
            onClick={() => {
              setError(false)
              iframeRef.current?.contentWindow?.postMessage({ type: 'PLANI_NAVIGATE', path: PAGE_MAP[page] ?? '/' }, PLANI_BASE)
            }}
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

      {/* iframe */}
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
