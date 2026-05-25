interface BreakdownItem {
  label: string
  value: number | string
}

interface HeroKpiProps {
  total: number | string
  unit?: string
  delta?: string
  periodo?: string
  breakdown?: BreakdownItem[]
}

export default function HeroKpi({
  total,
  unit = 'en nómina',
  delta,
  periodo,
  breakdown = [],
}: HeroKpiProps) {
  return (
    <div
      className="relative overflow-hidden flex items-center gap-8"
      style={{
        background: 'linear-gradient(135deg, #001A4D 0%, #002B7A 60%, #0040A8 100%)',
        borderRadius: 16,
        padding: '22px 26px',
        color: '#FFFFFF',
        boxShadow: '0 16px 36px -12px rgba(0,42,128,0.50), 0 0 0 1px rgba(255,255,255,0.10) inset',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -80,
          top: -80,
          width: 240,
          height: 240,
          background: 'radial-gradient(circle, rgba(122,176,255,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative flex-1 min-w-0">
        <p
          className="uppercase mb-1"
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.20em', color: '#7AB0FF' }}
        >
          Total agentes
        </p>
        <div className="flex items-baseline gap-3 mb-2">
          <span
            className="display-num"
            style={{ fontSize: 64, lineHeight: 0.85, color: '#FFFFFF' }}
          >
            {total}
          </span>
          <span className="font-medium" style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)' }}>
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {delta && (
            <span
              className="text-sm font-medium px-3 py-1 rounded-full"
              style={{
                background: 'rgba(122,176,255,0.18)',
                border: '1px solid rgba(122,176,255,0.32)',
                color: '#C9DDF8',
              }}
            >
              {delta}
            </span>
          )}
          {periodo && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{periodo}</span>
          )}
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="relative flex items-stretch gap-0 shrink-0">
          {breakdown.map((item, i) => (
            <div
              key={item.label}
              className="px-5 flex flex-col justify-center"
              style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.16)' } : undefined}
            >
              <p
                className="uppercase mb-1"
                style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.50)' }}
              >
                {item.label}
              </p>
              <span
                className="display-num"
                style={{ fontSize: 26, lineHeight: 1, color: '#FFFFFF' }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
