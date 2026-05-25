import type { LucideIcon } from 'lucide-react'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
type TrendTone = 'up' | 'down' | 'flat'

interface KpiCardProps {
  label?: string
  value: number | string
  icon?: LucideIcon
  tone?: Tone
  subtitle?: string
  valueSuffix?: string
  trend?: string
  trendTone?: TrendTone
  sparkline?: number[]
  title?: string
  color?: string
}

const TONE_MAP: Record<Tone, { rail: string; wash: string; iconBg: string; iconColor: string }> = {
  brand:   { rail: '#0054A6', wash: 'rgba(0,84,166,0.06)',    iconBg: 'rgba(0,84,166,0.08)',   iconColor: '#0054A6' },
  success: { rail: '#22C55E', wash: 'rgba(34,197,94,0.06)',   iconBg: 'rgba(34,197,94,0.08)',  iconColor: '#166534' },
  warning: { rail: '#F59E0B', wash: 'rgba(245,158,11,0.06)',  iconBg: 'rgba(245,158,11,0.08)', iconColor: '#92400E' },
  danger:  { rail: '#EF4444', wash: 'rgba(239,68,68,0.06)',   iconBg: 'rgba(239,68,68,0.08)',  iconColor: '#991B1B' },
  info:    { rail: '#3B82F6', wash: 'rgba(59,130,246,0.06)',  iconBg: 'rgba(59,130,246,0.08)', iconColor: '#1E40AF' },
  purple:  { rail: '#8B5CF6', wash: 'rgba(139,92,246,0.06)', iconBg: 'rgba(139,92,246,0.08)', iconColor: '#5B21B6' },
  neutral: { rail: '#64748B', wash: 'rgba(100,116,139,0.06)', iconBg: 'rgba(100,116,139,0.08)', iconColor: '#475569' },
}

const TREND_STYLE: Record<TrendTone, { bg: string; color: string }> = {
  up:   { bg: 'rgba(34,197,94,0.12)',   color: '#15803D' },
  down: { bg: 'rgba(220,38,38,0.10)',   color: '#B91C1C' },
  flat: { bg: 'rgba(100,116,139,0.10)', color: '#475569' },
}

const COLOR_TO_TONE: Record<string, Tone> = {
  orange: 'brand',
  blue:   'info',
  green:  'success',
  yellow: 'warning',
  red:    'danger',
  purple: 'purple',
  gray:   'neutral',
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="flex items-end gap-0.5" style={{ height: 18 }}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 3,
            height: `${Math.max(10, v)}%`,
            borderRadius: 2,
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : 0.35,
            boxShadow: i === values.length - 1 ? `0 0 4px ${color}` : undefined,
            transition: 'opacity 160ms',
          }}
        />
      ))}
    </div>
  )
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  tone: toneProp = 'brand',
  subtitle,
  valueSuffix,
  trend,
  trendTone = 'up',
  sparkline,
  title,
  color,
}: KpiCardProps) {
  const displayLabel = label || title || ''
  const tone: Tone = color && COLOR_TO_TONE[color] ? COLOR_TO_TONE[color] : toneProp
  const { rail, wash, iconBg, iconColor } = TONE_MAP[tone]
  const trendStyle = TREND_STYLE[trendTone]

  return (
    <div
      className="relative overflow-hidden bg-white rounded-xl border border-gray-200/80 group flex flex-col"
      style={{
        padding: '16px 16px 14px 20px',
        minHeight: 120,
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.06)',
        transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 16px 36px -10px rgba(15,23,42,0.14), 0 4px 8px -4px rgba(15,23,42,0.06)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.06)'
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderRadius: '14px 0 0 14px',
          backgroundColor: rail,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 4,
          top: 0,
          bottom: 0,
          width: '65%',
          background: `linear-gradient(90deg, ${wash} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p
            className="uppercase"
            style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: '#6B7280', lineHeight: 1 }}
          >
            {displayLabel}
          </p>
          {Icon && (
            <div
              className="flex items-center justify-center shrink-0 rounded-lg"
              style={{ width: 30, height: 30, backgroundColor: iconBg, color: iconColor }}
            >
              <Icon size={14} strokeWidth={2} />
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span
            className="display-num"
            style={{ fontSize: 38, lineHeight: 0.9, color: '#0F172A' }}
          >
            {value}
          </span>
          {valueSuffix && (
            <span className="font-medium" style={{ fontSize: 14, color: '#6B7280' }}>
              · {valueSuffix}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className="font-bold"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: trendStyle.bg,
                  color: trendStyle.color,
                }}
              >
                {trend}
              </span>
            )}
            {subtitle && !trend && (
              <span style={{ fontSize: 11.5, color: '#6B7280' }}>{subtitle}</span>
            )}
          </div>
          {sparkline && <Sparkline values={sparkline} color={rail} />}
        </div>
      </div>
    </div>
  )
}
