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
  orange: { accent: 'bg-konecta',    icon: 'bg-konecta/10 text-konecta'  },
  purple: { accent: 'bg-purple-500', icon: 'bg-purple-50 text-purple-600' },
  green:  { accent: 'bg-green-500',  icon: 'bg-green-50 text-green-600'   },
  blue:   { accent: 'bg-blue-500',   icon: 'bg-blue-50 text-blue-600'     },
  yellow: { accent: 'bg-yellow-400', icon: 'bg-yellow-50 text-yellow-600' },
  red:    { accent: 'bg-red-500',    icon: 'bg-red-50 text-red-600'       },
  gray:   { accent: 'bg-gray-400',   icon: 'bg-gray-100 text-gray-500'    },
}

export default function KpiCard({ title, value, icon: Icon, color = 'orange', subtitle, trend }: KpiCardProps) {
  const colors = COLOR_MAP[color]
  return (
    <div className="relative card p-5 hover:shadow-card-hover transition-all duration-200 overflow-hidden group">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${colors.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-2">{title}</p>
          <p className="text-[2rem] font-bold leading-none tabular-nums text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-2 leading-tight">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-semibold mt-2 ${trend.value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}
