import type { ThemeAccent } from '@/types/database.types'

// SVG presentation attributes (stroke, stopColor, fill as plain attribute
// strings) don't reliably resolve CSS custom properties across browsers, so
// charts need concrete hex values that are recomputed when the theme changes,
// rather than `rgb(var(--accent))` baked into the JSX.
export const ACCENT_HEX: Record<ThemeAccent, string> = {
  violet: '#6558D3',
  ocean: '#0284C7',
  sunset: '#EA580C',
  pink: '#DB2777',
  green: '#16A34A',
}

export interface ChartTheme {
  accent: string
  caution: string
  border: string
  tick: string
  tooltipBg: string
}

export function getChartTheme(accent: ThemeAccent, isDark: boolean): ChartTheme {
  return {
    accent: ACCENT_HEX[accent],
    caution: isDark ? '#F0A558' : '#E58A2E',
    border: isDark ? '#30343f' : '#E6E6ED',
    tick: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#1E2129' : '#FFFFFF',
  }
}
