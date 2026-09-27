import type { CSSProperties } from 'react'
import type { ChartTheme } from '@/lib/themeColors'

/**
 * Shared Recharts styling so every chart follows the design canvas's
 * "Ledger Noir" look and the Motion spec: 900 ms ease-out growth (bars,
 * areas, donut), a short stagger between series, soft rounded tooltips with
 * tabular figures, hairline horizontal grid, and no motion at all when the
 * user prefers reduced motion.
 */

export const CHART_MOTION_MS = 900
/** Delay between consecutive series (e.g. income then spending). */
export const CHART_STAGGER_MS = 120

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Animation props for one series; `index` staggers it after the ones before. */
export function seriesMotion(index = 0) {
  const reduced = prefersReducedMotion()
  return {
    isAnimationActive: !reduced,
    animationDuration: CHART_MOTION_MS,
    animationBegin: reduced ? 0 : index * CHART_STAGGER_MS,
    animationEasing: 'ease-out' as const,
  }
}

export function axisTick(colors: ChartTheme, fontSize = 12) {
  return { fontSize, fill: colors.tick, fontFamily: 'inherit' }
}

/** Hairline horizontal grid, no vertical lines. */
export function gridProps(colors: ChartTheme) {
  return { vertical: false, stroke: colors.border, strokeOpacity: 0.7 }
}

export function tooltipProps(colors: ChartTheme) {
  const contentStyle: CSSProperties = {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(15, 17, 24, 0.18)',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  }
  return {
    contentStyle,
    labelStyle: { color: colors.tick, fontSize: 12, fontWeight: 600, marginBottom: 2 } as CSSProperties,
    itemStyle: { fontSize: 13, fontWeight: 600, padding: 0 } as CSSProperties,
    cursor: { fill: colors.border, fillOpacity: 0.35, stroke: colors.border },
  }
}
