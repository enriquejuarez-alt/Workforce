import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { authApi } from '../lib/api'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled:    'Cancelaste el inicio de sesión con Google.',
  google_token_failed: 'No se pudo obtener acceso de Google. Intentá de nuevo.',
  google_no_email:     'Tu cuenta de Google no tiene email verificado.',
  google_server_error: 'Error en el servidor al procesar el login.',
  user_not_found:      'Tu cuenta no tiene acceso al sistema. Contactá al administrador.',
  user_inactive:       'Tu usuario está desactivado. Contactá al administrador.',
  unknown:             'Ocurrió un error inesperado.',
}

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [handlingCallback, setHandlingCallback] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const error = params.get('error')
    const oauthErr = params.get('oauth_error')

    if (oauthErr) { setOauthError(decodeURIComponent(oauthErr)); return }
    if (error) { setOauthError(ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown); return }

    if (token) {
      setHandlingCallback(true)
      localStorage.setItem('token', token)
      authApi.me()
        .then((res) => { setAuth(res.data, token); navigate('/dashboard', { replace: true }) })
        .catch(() => {
          localStorage.removeItem('token')
          setOauthError(ERROR_MESSAGES.unknown)
          setHandlingCallback(false)
        })
    }
  }, [navigate, setAuth])

  if (handlingCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)' }}>
        <div className="text-center space-y-3">
          <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/50 font-medium">Verificando tu cuenta...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)' }}
    >
      {/* Grid pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.10] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 60%)' }} />
      <div className="fixed bottom-0 left-0 w-96 h-96 rounded-full blur-[100px] opacity-[0.08] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)' }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-xl mb-4">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <p className="text-white/30 text-xs font-semibold tracking-widest uppercase">Walt · Konecta</p>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
            Bienvenido
          </h1>
          <p className="text-white/35 text-sm">Iniciá sesión con tu cuenta corporativa</p>
        </div>

        {/* Error */}
        {oauthError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 font-medium">{oauthError}</p>
          </div>
        )}

        {/* Login box */}
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <a
            href="/api/auth/google"
            className="w-full h-12 rounded-xl bg-white hover:bg-gray-50 flex items-center justify-center gap-3 text-sm font-semibold text-gray-800 transition-all active:scale-[.98]"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >
            <GoogleIcon />
            Continuar con Google
          </a>

          <div className="flex items-start gap-2.5 bg-blue-500/8 border border-blue-500/15 rounded-xl px-3.5 py-3">
            <span className="text-blue-400 text-sm leading-none mt-0.5 shrink-0">ℹ</span>
            <p className="text-xs text-blue-300/80 leading-relaxed">
              Usá tu cuenta <span className="font-bold text-blue-300">nombre.apellido@konecta.com</span>. Otros dominios no tienen acceso al sistema.
            </p>
          </div>
        </div>

        <p className="text-center text-white/15 text-[11px] tracking-widest uppercase font-medium mt-8">
          Proyecto Walt · v2
        </p>
      </div>
    </div>
  )
}
