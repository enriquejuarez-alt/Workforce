import type { EstadoNomina } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange' | 'gray'
  size?: 'sm' | 'md'
  dot?: boolean
}

const VARIANTS = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  gray: 'bg-slate-100 text-slate-600',
}

const DOT_VARIANTS = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  gray: 'bg-slate-500',
}

export default function Badge({ children, variant = 'default', size = 'sm', dot = false }: BadgeProps) {
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${VARIANTS[variant]} ${padding}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_VARIANTS[variant]}`} />}
      {children}
    </span>
  )
}

export function NominaEstadoBadge({ estado }: { estado: EstadoNomina }) {
  const map: Record<EstadoNomina, { label: string; variant: BadgeProps['variant'] }> = {
    BORRADOR: { label: 'Borrador', variant: 'warning' },
    ACTIVA: { label: 'Activa', variant: 'success' },
    CERRADA: { label: 'Cerrada', variant: 'gray' },
    ARCHIVADA: { label: 'Archivada', variant: 'gray' },
  }
  const { label, variant } = map[estado] || { label: estado, variant: 'default' }
  return <Badge variant={variant} dot>{label}</Badge>
}

export function EstadoAgenteBadge({ estado }: { estado: string | null }) {
  if (!estado) return null
  const s = estado.toLowerCase()
  const variant =
    s.includes('activ') ? 'success' :
    s.includes('inactiv') || s.includes('baja') ? 'danger' :
    s.includes('licencia') ? 'warning' :
    'default'
  return <Badge variant={variant}>{estado}</Badge>
}

export function LicenciaBadge({ tipo }: { tipo: 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA' }) {
  const map = {
    VIGENTE: { label: 'Licencia vigente', variant: 'warning' as const },
    PROGRAMADA: { label: 'Licencia programada', variant: 'info' as const },
    FINALIZADA: { label: 'Licencia finalizada', variant: 'gray' as const },
  }
  return <Badge variant={map[tipo].variant}>{map[tipo].label}</Badge>
}

export function CambioTemporalBadge({ servicio }: { servicio?: string | null }) {
  return <Badge variant="info" dot>{servicio ? `Cambio → ${servicio}` : 'Cambio temporal'}</Badge>
}

export function ServicioBadge({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {nombre}
    </span>
  )
}
