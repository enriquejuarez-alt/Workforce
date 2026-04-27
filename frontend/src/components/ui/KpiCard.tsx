import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color?: 'orange' | 'purple' | 'green' | 'blue' | 'yellow' | 'red' | 'gray'
  subtitle?: string
  trend?: { value: number; label: string }
}

const COLOR_MAP = {
  orange: { bg: 'bg-orange-50', icon: 'bg-konecta text-white', value: 'text-konecta' },
  purple: { bg: 'bg-purple-50', icon: 'bg-konecta text-white', value: 'text-konecta' },
  green: { bg: 'bg-green-50', icon: 'bg-green-600 text-white', value: 'text-green-700' },
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-600 text-white', value: 'text-blue-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-500 text-white', value: 'text-yellow-700' },
  red: { bg: 'bg-red-50', icon: 'bg-red-600 text-white', value: 'text-red-700' },
  gray: { bg: 'bg-gray-50', icon: 'bg-gray-500 text-white', value: 'text-gray-700' },
}

export default function KpiCard({ title, value, icon: Icon, color = 'orange', subtitle, trend }: KpiCardProps) {
  const colors = COLOR_MAP[color]
  return (
    <div className={`card p-5 hover:shadow-card-hover transition-shadow ${colors.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${colors.value}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-2 ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl ${colors.icon} flex items-center justify-center shrink-0`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
