import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight } from 'lucide-react'
import Header from '../components/layout/Header'

export default function Permisos() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col h-full">
      <Header title="Gestión de Permisos" subtitle="Administrar accesos por usuario y servicio" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-konecta" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Gestión de permisos</h2>
          <p className="text-sm text-gray-500 mb-6">
            Los permisos se administran desde el módulo de Usuarios. Seleccioná un usuario y configurá sus accesos por servicio.
          </p>
          <button className="btn-primary" onClick={() => navigate('/usuarios')}>
            <ArrowRight size={14} /> Ir a Usuarios
          </button>
        </div>
      </div>
    </div>
  )
}
