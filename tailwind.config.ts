import type { Config } from 'tailwindcss'

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: withOpacity('--app-bg'),
          card: withOpacity('--app-card'),
          border: withOpacity('--app-border'),
          navy: '#1B1B3A',
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          light: withOpacity('--accent-light'),
          dark: withOpacity('--accent-dark'),
        },
        positive: {
          DEFAULT: withOpacity('--positive'),
          light: withOpacity('--positive-light'),
        },
        caution: {
          DEFAULT: withOpacity('--caution'),
          light: withOpacity('--caution-light'),
        },
        info: {
          DEFAULT: withOpacity('--info'),
          light: withOpacity('--info-light'),
        },
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 16, 40, 0.04), 0 4px 12px rgba(16, 16, 40, 0.06)',
      },
      fontSize: {
        body: ['15px', '22px'],
        helper: ['12.5px', '18px'],
      },
    },
  },
  plugins: [],
} satisfies Config
