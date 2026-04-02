/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        radar: {
          bg:      '#0a0f0a',
          ring:    '#1a3a1a',
          glow:    '#00ff41',
          dim:     '#00aa2a',
          sweep:   '#00ff4133',
        },
        space: {
          bg:      '#05050f',
          nebula:  '#1a1a3a',
          star:    '#a0a8ff',
          node:    '#6366f1',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'radar-sweep': 'radarSweep 4s linear infinite',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        radarSweep: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.15)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
