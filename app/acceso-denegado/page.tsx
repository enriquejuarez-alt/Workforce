"use client";

import { useRouter } from 'next/navigation'
import { ShieldOff, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { getDefaultPath } from '@/lib/utils/roles'

export default function AccesoDenegadoPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <ShieldOff size={36} className="text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
        <p className="text-gray-500 text-sm mb-8">
          Tu rol no tiene permisos para acceder a esta sección. Si creés que es un error,
          contactá al administrador del sistema.
        </p>
        <button
          onClick={() => router.push(getDefaultPath(user?.rol))}
          className="inline-flex items-center gap-2 btn-primary"
        >
          <ArrowLeft size={14} /> Volver al inicio
        </button>
      </div>
    </div>
  )
}
