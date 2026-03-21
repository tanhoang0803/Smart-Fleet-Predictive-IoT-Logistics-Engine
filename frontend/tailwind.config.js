// Smart-Fleet IoT — Tailwind Config
// TanQHoang © 2026

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Alert status colors — used by MaintenanceGauge and AlertBanner
        status: {
          normal:   '#22c55e', // green-500
          warning:  '#eab308', // yellow-500
          critical: '#f97316', // orange-500
          overdue:  '#ef4444', // red-500
        },
        fleet: {
          bg:      '#0f172a', // slate-900
          surface: '#1e293b', // slate-800
          border:  '#334155', // slate-700
          text:    '#e2e8f0', // slate-200
          muted:   '#94a3b8', // slate-400
          accent:  '#3b82f6', // blue-500
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
