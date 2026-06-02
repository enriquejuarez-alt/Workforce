import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
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
  const [startingLogin, setStartingLogin] = useState(false)

  const handleGoogleLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (startingLogin) return
    setStartingLogin(true)
    window.setTimeout(() => {
      window.location.href = '/api/auth/google'
    }, 900)
  }

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
      <style>{`
        @keyframes gridDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-48px, -48px, 0); }
        }
        @keyframes beamSweep {
          0%, 100% { transform: translateX(-12%) rotate(-9deg); opacity: 0.16; }
          50% { transform: translateX(12%) rotate(-9deg); opacity: 0.30; }
        }
        @keyframes beamSweepAlt {
          0%, 100% { transform: translateX(10%) rotate(11deg); opacity: 0.10; }
          45% { transform: translateX(-10%) rotate(11deg); opacity: 0.24; }
        }
        @keyframes starDrift {
          from { background-position: 0 0, 40px 70px, 0 0; }
          to { background-position: 240px -160px, -120px 220px, 0 0; }
        }
        @keyframes cardGlow {
          0%, 100% { opacity: 0.38; transform: scale(0.96); }
          50% { opacity: 0.62; transform: scale(1.04); }
        }
        @keyframes loginPulse {
          0% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.28); }
          70% { box-shadow: 0 0 0 18px rgba(96, 165, 250, 0); }
          100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
        }
        .login-grid { animation: gridDrift 22s linear infinite; }
        .login-stars {
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.22) 0 1px, transparent 1px),
            radial-gradient(circle, rgba(96,165,250,0.22) 0 1px, transparent 1px),
            linear-gradient(180deg, transparent, rgba(2,8,24,0.35));
          background-size: 120px 120px, 180px 180px, 100% 100%;
          animation: starDrift 28s linear infinite;
        }
        .login-beam-a {
          animation: beamSweep 16s ease-in-out infinite;
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.16), rgba(129,140,248,0.10), transparent);
        }
        .login-beam-b {
          animation: beamSweepAlt 19s ease-in-out infinite;
          background: linear-gradient(90deg, transparent, rgba(34,197,94,0.08), rgba(96,165,250,0.13), transparent);
        }
        .login-card-glow { animation: cardGlow 8s ease-in-out infinite; }
        .login-pulse { animation: loginPulse 1.2s ease-out infinite; }
      `}</style>

      {/* Grid pattern */}
      <div
        className="login-grid fixed inset-[-48px] opacity-[0.055] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="login-stars fixed inset-0 opacity-70 pointer-events-none" />
      <div className="login-beam-a fixed left-[-20%] top-[18%] h-44 w-[140%] blur-2xl pointer-events-none" />
      <div className="login-beam-b fixed left-[-20%] bottom-[18%] h-40 w-[140%] blur-2xl pointer-events-none" />
      <div
        className="login-card-glow fixed left-1/2 top-1/2 h-[440px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,84,166,0.34), rgba(79,70,229,0.12) 42%, transparent 72%)' }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 44%, transparent 0%, transparent 26%, rgba(2,8,24,0.30) 58%, rgba(2,8,24,0.72) 100%)' }}
      />

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
            onClick={handleGoogleLogin}
            aria-disabled={startingLogin}
            className={`w-full h-12 rounded-xl flex items-center justify-center gap-3 text-sm font-semibold transition-all active:scale-[.98] ${
              startingLogin
                ? 'login-pulse bg-blue-50 text-[#0054A6] cursor-wait'
                : 'bg-white hover:bg-gray-50 text-gray-800'
            }`}
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >
            {startingLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {startingLogin ? 'Conectando con Google...' : 'Continuar con Google'}
          </a>

          {startingLogin && (
            <div className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3.5 py-3">
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-blue-300 transition-all duration-700" />
              </div>
              <p className="text-center text-[11px] font-medium text-blue-200/80">
                Preparando autenticacion segura...
              </p>
            </div>
          )}

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
