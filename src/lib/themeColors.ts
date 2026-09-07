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
  sage: '#6B8E7A',
  mauve: '#A38191',
  plum: '#7A2A59',
  crimson: '#B92D37',
  charcoal: '#474E5C',
  // Never actually read -- ThemeContext resolves 'custom' to the user's own
  // hex before anything looks it up here. Present only so this record stays
  // complete over every ThemeAccent value.
  custom: '#6558D3',
}

export interface ChartTheme {
  accent: string
  positive: string
  caution: string
  border: string
  tick: string
  tooltipBg: string
}

/** `accentHex` is the resolved concrete color (from `useTheme().accentHex`)
 *  rather than the `ThemeAccent` enum -- this needs to work for a custom
 *  user-picked color too, which has no entry in `ACCENT_HEX`. */
export function getChartTheme(accentHex: string, isDark: boolean): ChartTheme {
  return {
    accent: accentHex,
    // Matches the `--positive` CSS token (index.css) -- a fixed, semantic
    // green rather than the user's chosen brand accent, so charts comparing
    // money in vs. money out read the same conventional way (green = income)
    // regardless of which accent color the user has picked.
    positive: isDark ? '#4AC995' : '#1E9E6B',
    caution: isDark ? '#F0A558' : '#E58A2E',
    border: isDark ? '#30343f' : '#E6E6ED',
    tick: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#1E2129' : '#FFFFFF',
  }
}
