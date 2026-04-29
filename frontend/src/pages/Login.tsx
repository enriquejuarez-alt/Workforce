import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/auth'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.data.user, res.data.token)
      const meRes = await authApi.me()
      setAuth(meRes.data, res.data.token)
      toast.success(`Bienvenido, ${res.data.user.nombre}`)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel */}
      <div
        className="hidden lg:flex w-5/12 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #000E28 0%, #001540 50%, #001E52 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #0054A6 0%, transparent 70%)' }} />
        <div className="absolute bottom-10 left-0 w-64 h-64 rounded-full opacity-8 blur-3xl"
          style={{ background: 'radial-gradient(circle, #1A6EC2 0%, transparent 70%)' }} />

        <div className="relative z-10 text-center max-w-xs">
          {/* Logo */}
          <div className="mb-8">
            <img
              src="/logo.jpg"
              alt="Logo"
              className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-2xl ring-4 ring-white/10"
            />
          </div>

          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            Gestión de Nómina
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-10">
            Control total de nóminas mensuales, licencias, cambios y permisos por servicio.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Servicios', value: 'Multi' },
              { label: 'Roles', value: 'Granular' },
              { label: 'Histórico', value: 'Completo' },
            ].map((item) => (
              <div key={item.label} className="bg-white/6 rounded-xl p-3 border border-white/8">
                <p className="text-white font-bold text-base">{item.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-white/20 text-xs font-medium tracking-wide uppercase">
            Proyecto Walt · v2
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden mb-8">
            <img src="/logo.jpg" alt="Logo" className="w-9 h-9 rounded-xl object-cover shadow" />
            <span className="text-base font-bold text-gray-900">Gestión de Nómina</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Iniciar sesión</h2>
            <p className="text-gray-500 text-sm mt-1">Ingresá tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label-base">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="usuario@empresa.com"
                className="input-base"
                autoFocus
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label-base">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5 mt-2"
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">Credenciales de prueba</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">admin@konecta.com</span> · admin123</p>
              <p><span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">supervisor.soporte@konecta.com</span> · supervisor123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
