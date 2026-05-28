"use client";

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, Loader2, Users, FileSpreadsheet, ArrowLeftRight, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})
type FormData = z.infer<typeof schema>

const CREDENTIALS = [
  { label: 'Admin', email: 'admin@konecta.com', pass: 'admin123', color: 'bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-700' },
  { label: 'Supervisor', email: 'supervisor.soporte@konecta.com', pass: 'supervisor123', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700' },
]

function AppMockup() {
  const kpis = [
    { title: 'Total en nómina', value: '248', icon: Users, iconBg: 'bg-blue-600', valueCl: 'text-blue-400', cardBg: 'bg-blue-500/8' },
    { title: 'Activos', value: '201', sub: 'Estado ACTIVO', icon: Users, iconBg: 'bg-green-600', valueCl: 'text-green-400', cardBg: 'bg-green-500/8' },
    { title: 'Licencia', value: '31', sub: 'Vigente hoy', icon: Clock, iconBg: 'bg-yellow-500', valueCl: 'text-yellow-400', cardBg: 'bg-yellow-500/8' },
    { title: 'Dados de baja', value: '16', sub: 'Desactivados', icon: Users, iconBg: 'bg-red-600', valueCl: 'text-red-400', cardBg: 'bg-red-500/8' },
    { title: 'No presentes', value: '8', sub: 'Última carga', icon: Clock, iconBg: 'bg-gray-600', valueCl: 'text-gray-400', cardBg: 'bg-white/4' },
  ]

  const ops = [
    { title: 'Lic. vigentes', value: '31', icon: Clock, iconBg: 'bg-yellow-500', valueCl: 'text-yellow-400', cardBg: 'bg-yellow-500/8' },
    { title: 'Lic. programadas', value: '12', icon: Clock, iconBg: 'bg-blue-500', valueCl: 'text-blue-400', cardBg: 'bg-blue-500/8' },
    { title: 'Cambios temp.', value: '8', icon: ArrowLeftRight, iconBg: 'bg-blue-600', valueCl: 'text-blue-400', cardBg: 'bg-blue-500/8' },
    { title: 'Nóminas activas', value: '3', sub: 'Mes corriente', icon: FileSpreadsheet, iconBg: 'bg-green-600', valueCl: 'text-green-400', cardBg: 'bg-green-500/8' },
  ]

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 select-none">
      {/* Browser chrome */}
      <div className="bg-[#0d1117] px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
        </div>
        <div className="flex-1 mx-2 bg-white/5 rounded px-2 py-0.5 text-white/20 font-mono text-[8.5px]">
          gestionnomina.konecta.com/dashboard
        </div>
      </div>

      {/* Header bar */}
      <div className="bg-[#0f1729] border-b border-white/5 px-4 py-2.5 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-extrabold text-white/85 leading-none">Dashboard</div>
          <div className="text-[9px] text-white/30 mt-0.5">lunes 4 de mayo de 2026</div>
        </div>
        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[8px] font-semibold text-green-400">Bienvenido, Administrador Konecta</span>
        </div>
      </div>

      {/* Body */}
      <div className="bg-[#0c1220] p-3 space-y-3">
        {/* KPIs */}
        <div>
          <p className="text-[8px] font-bold text-white/25 uppercase tracking-widest mb-1.5">
            Resumen de agentes — mes corriente
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {kpis.map((k) => (
              <div key={k.title} className={`${k.cardBg} rounded-xl p-2 border border-white/5`}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[7px] font-semibold text-white/35 uppercase leading-tight truncate">{k.title}</p>
                    <p className={`text-[18px] font-bold leading-tight mt-0.5 ${k.valueCl}`}>{k.value}</p>
                    {k.sub && <p className="text-[7px] text-white/25 leading-tight mt-0.5 truncate">{k.sub}</p>}
                  </div>
                  <div className={`w-6 h-6 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                    <k.icon size={11} className="text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ops */}
        <div>
          <p className="text-[8px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Estado operativo</p>
          <div className="grid grid-cols-4 gap-1.5">
            {ops.map((k) => (
              <div key={k.title} className={`${k.cardBg} rounded-xl p-2 border border-white/5`}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[7px] font-semibold text-white/35 uppercase leading-tight truncate">{k.title}</p>
                    <p className={`text-[18px] font-bold leading-tight mt-0.5 ${k.valueCl}`}>{k.value}</p>
                    {k.sub && <p className="text-[7px] text-white/25 leading-tight mt-0.5">{k.sub}</p>}
                  </div>
                  <div className={`w-6 h-6 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                    <k.icon size={11} className="text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { title: 'Última importación', sub: 'Sin importaciones registradas', icon: FileSpreadsheet },
            { title: 'Agentes por servicio', sub: 'Sin datos de servicios', icon: Users },
          ].map((c) => (
            <div key={c.title} className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <c.icon size={9} className="text-white/30" />
                <p className="text-[9px] font-bold text-white/50">{c.title}</p>
              </div>
              <p className="text-[8px] text-white/25">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filledWith, setFilledWith] = useState<string | null>(null)

  const oauthError = searchParams.get('oauth_error')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fillCredentials = (cred: typeof CREDENTIALS[number]) => {
    setValue('email', cred.email, { shouldValidate: true })
    setValue('password', cred.pass, { shouldValidate: true })
    setFilledWith(cred.label)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.data.user, res.data.token)
      const meRes = await authApi.me()
      setAuth(meRes.data, res.data.token)
      toast.success(`Bienvenido, ${res.data.user.nombre}`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex w-[52%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)' }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.12]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 60%)' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-[80px] opacity-[0.10]"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)' }} />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/10" />
          <span className="text-white/50 text-sm font-semibold">Walt · Konecta</span>
        </div>

        {/* Headline + mockup */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-blue-400/70 text-[11px] font-bold tracking-widest uppercase mb-3">
              Gestión de Personal
            </p>
            <h1 className="text-[2.4rem] font-black text-white leading-[1.08] tracking-tight">
              Todo tu equipo,<br />
              <span style={{
                background: 'linear-gradient(90deg, #60a5fa 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                bajo control.
              </span>
            </h1>
          </div>

          <AppMockup />
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/15 text-[10px] tracking-widest uppercase font-medium">Proyecto Walt · v2</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-gray-50">
        <div className="w-full max-w-[340px]">

          {/* Mobile header */}
          <div className="flex items-center gap-2.5 lg:hidden mb-10">
            <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-xl object-cover" />
            <span className="text-sm font-bold text-gray-900">Gestión de Nómina</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[1.65rem] font-extrabold text-gray-900 tracking-tight leading-tight">
              Bienvenido
            </h2>
            <p className="text-gray-400 text-sm mt-1">Ingresá tus credenciales para continuar</p>
          </div>

          {/* OAuth error */}
          {oauthError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
              <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-600 font-medium">{decodeURIComponent(oauthError)}</p>
            </div>
          )}

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="usuario@konecta.com"
                  autoFocus
                  className={`w-full h-10 px-3.5 text-sm rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-300 outline-none transition-all
                    focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/8
                    ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full h-10 px-3.5 pr-10 text-sm rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-300 outline-none transition-all
                      focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/8
                      ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 mt-1 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 active:scale-[.98]"
                style={{
                  background: loading ? '#3b82f6' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.30)',
                }}
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Ingresando...</>
                ) : (
                  <>Ingresar <ArrowRight size={15} /></>
                )}
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300">o</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <a
                href="/api/auth/google"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2.5 text-sm font-medium text-gray-700 transition-all active:scale-[.98]"
              >
                <GoogleIcon />
                Continuar con Google
              </a>
            </form>
          </div>

          {/* Test credentials — click to fill */}
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Credenciales de prueba — click para completar
            </p>
            <div className="space-y-2">
              {CREDENTIALS.map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => fillCredentials(cred)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border text-xs transition-all active:scale-[.98] ${cred.color}
                    ${filledWith === cred.label ? 'ring-2 ring-offset-1 ring-current/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{cred.label}</span>
                    {filledWith === cred.label && (
                      <span className="text-[10px] opacity-60 font-medium">✓ cargado</span>
                    )}
                  </div>
                  <div className="font-mono opacity-60 mt-0.5 text-[11px]">{cred.email}</div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
