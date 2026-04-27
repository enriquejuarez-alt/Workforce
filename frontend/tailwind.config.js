/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        konecta: {
          DEFAULT: '#0054A6',
          dark: '#003D7C',
          light: '#1A6EC2',
          muted: '#CCE0F5',
          navy: '#001E50',
          mid: '#00389E',
        },
        sidebar: {
          bg: '#001E50',
          hover: '#003070',
          active: '#0054A6',
          text: '#95B8D8',
          'text-active': '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-konecta',
    'bg-konecta-dark',
    'bg-konecta-light',
    'bg-konecta-muted',
    'bg-konecta-navy',
    'text-konecta',
    'text-konecta-dark',
    'text-konecta-light',
    'border-konecta',
    'ring-konecta',
    'bg-sidebar-bg',
    'bg-sidebar-hover',
    'bg-sidebar-active',
  ],
}
