/**
 * tailwind.config.js — Nómina Konecta redesign patch
 *
 * Drop-in replacement. Preserves all existing tokens and ADDS:
 *   - Brand Royal sidebar palette
 *   - Semantic color triplets (success/warning/danger/info/purple/neutral)
 *   - Serif (Instrument Serif) + Sans (Manrope) + Mono (JetBrains Mono)
 *   - konecta-pale (#EAF2FB) for hover rows
 *   - shadow-popover, shadow-brand, shadow-navy-lg
 */

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        konecta: {
          DEFAULT: '#0054A6',
          dark:    '#003D7C',
          light:   '#1A6EC2',
          muted:   '#CCE0F5',
          navy:    '#001E50',
          mid:     '#00389E',
          pale:    '#EAF2FB',
        },
        // SIDEBAR — "Brand Royal" palette
        sidebar: {
          'grad-from':   '#001A4D',
          'grad-mid':    '#002B7A',
          'grad-to':     '#0040A8',
          bg:            '#002B7A',
          hover:         'rgba(255,255,255,0.06)',
          active:        'rgba(255,255,255,0.14)',
          text:          '#B6CDEF',
          'text-active': '#FFFFFF',
          rail:          '#7AB0FF',
          divider:       'rgba(255,255,255,0.10)',
        },
        // SEMANTIC — each variant has bg/fg/dot
        success: { bg: '#DCFCE7', fg: '#166534', dot: '#22C55E' },
        warning: { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
        danger:  { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444' },
        info:    { bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6' },
        purplex: { bg: '#EDE9FE', fg: '#5B21B6', dot: '#8B5CF6' },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans:  ['Manrope', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.025em',
        eyebrow:  '0.14em',
        cmd:      '0.18em',
      },
      boxShadow: {
        card:        '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover':'0 6px 16px -4px rgba(15,23,42,0.14), 0 2px 4px -2px rgba(15,23,42,0.06)',
        'card-lg':   '0 16px 36px -10px rgba(15,23,42,0.14), 0 4px 8px -4px rgba(15,23,42,0.06)',
        popover:     '0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 12px -4px rgba(15,23,42,0.08)',
        brand:       '0 2px 8px rgba(0,84,166,0.35)',
        'brand-lg':  '0 12px 24px -6px rgba(0,84,166,0.52), 0 3px 6px -2px rgba(0,84,166,0.30)',
        'navy-lg':   '0 16px 36px -12px rgba(0,42,128,0.50), 0 0 0 1px rgba(255,255,255,0.10) inset',
      },
      borderRadius: {
        '4xl': '20px',
      },
      transitionTimingFunction: {
        emph: 'cubic-bezier(0.16, 1, 0.3, 1)',
        std:  'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-konecta', 'bg-konecta-dark', 'bg-konecta-light', 'bg-konecta-muted',
    'bg-konecta-navy', 'bg-konecta-pale',
    'text-konecta', 'text-konecta-dark', 'text-konecta-light',
    'border-konecta', 'ring-konecta',
    'bg-sidebar-bg', 'bg-sidebar-hover', 'bg-sidebar-active',
  ],
}
