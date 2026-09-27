import type { Config } from 'tailwindcss'

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Self-hosted via @fontsource (imported in main.tsx), so they work offline in the PWA.
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
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
          // Text/icon color specifically for content drawn on top of
          // accent-light (pills, badges, active-nav, tinted cards) -- see
          // the --accent-on-light comment in index.css for why this needs
          // to be a separate token from accent-dark.
          'on-light': withOpacity('--accent-on-light'),
        },
        positive: {
          DEFAULT: withOpacity('--positive'),
          light: withOpacity('--positive-light'),
        },
        caution: {
          DEFAULT: withOpacity('--caution'),
          light: withOpacity('--caution-light'),
        },
        brass: {
          DEFAULT: withOpacity('--brass'),
          light: withOpacity('--brass-light'),
        },
        info: {
          DEFAULT: withOpacity('--info'),
          light: withOpacity('--info-light'),
        },
        danger: {
          DEFAULT: withOpacity('--danger'),
          light: withOpacity('--danger-light'),
        },
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 16, 40, 0.04), 0 4px 12px rgba(16, 16, 40, 0.06)',
        'card-lg': '0 4px 8px rgba(16, 16, 40, 0.06), 0 12px 32px rgba(16, 16, 40, 0.12)',
      },
      fontSize: {
        body: ['15px', '22px'],
        helper: ['12.5px', '18px'],
      },
    },
  },
  plugins: [],
} satisfies Config
