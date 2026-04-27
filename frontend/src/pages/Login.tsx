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
      <div className="hidden lg:flex w-1/2 bg-sidebar-bg flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-konecta blur-3xl" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-konecta-light blur-3xl" />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-konecta flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-black text-3xl">K</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Konecta</h1>
          <p className="text-konecta-light text-lg font-medium mb-2">Sistema de Gestión de Nómina</p>
          <p className="text-white/50 text-sm max-w-xs">
            Administrá nóminas mensuales de agentes de call center con control total de permisos e histórico.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Servicios', value: 'Multi' },
              { label: 'Roles', value: 'Granular' },
              { label: 'Histórico', value: 'Completo' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-3">
                <p className="text-white font-bold text-lg">{item.value}</p>
                <p className="text-white/50 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 lg:hidden mb-6">
              <div className="w-8 h-8 rounded-lg bg-konecta flex items-center justify-center">
                <span className="text-white font-black text-sm">K</span>
              </div>
              <span className="text-lg font-bold text-gray-900">Konecta Nómina</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="text-gray-500 text-sm mt-1">Ingresá tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label-base">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="usuario@konecta.com"
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

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              <LogIn size={16} />
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">Credenciales de prueba:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="font-mono bg-white px-1 rounded">admin@konecta.com</span> / admin123 (Admin)</p>
              <p><span className="font-mono bg-white px-1 rounded">supervisor.soporte@konecta.com</span> / supervisor123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
