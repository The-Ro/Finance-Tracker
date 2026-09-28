import { useEffect, useState } from 'react'
import type { DonutSegment } from '@/lib/monthlyReview'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const RADIUS = 70
const STROKE = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Gap between neighbouring segments, in stroke-length units. */
const GAP = 2.5
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * Segment colors as theme tokens (Tailwind utilities, so they follow the
 * accent preset and light/dark mode): the user's accent leads, then fixed
 * chart hues, a lighter tint of the accent, and neutral gray for "Other".
 * `stroke` for the ring, `bg` for the matching legend dot.
 */
const PALETTE = [
  { stroke: 'stroke-accent dark:stroke-accent-dark', bg: 'bg-accent dark:bg-accent-dark' },
  { stroke: 'stroke-caution', bg: 'bg-caution' },
  { stroke: 'stroke-info', bg: 'bg-info' },
  { stroke: 'stroke-accent/40 dark:stroke-accent-dark/50', bg: 'bg-accent/40 dark:bg-accent-dark/50' },
]
const OTHER = { stroke: 'stroke-slate-400', bg: 'bg-slate-400' }

function segmentColor(segment: DonutSegment, index: number) {
  return segment.other ? OTHER : PALETTE[index % PALETTE.length]
}

function prefersReducedMotion(): boolean {
  return typeof window === 'undefined' || window.matchMedia(REDUCED_MOTION_QUERY).matches
}

interface SpendDonutProps {
  segments: DonutSegment[]
  /** Center figure, e.g. the compact spent total. */
  centerValue: string
  formatAmount: (n: number) => string
}

/**
 * Spend-mix ring plus its legend. Each segment draws in clockwise, one after
 * another, by transitioning its dash length from 0 once mounted; with reduced
 * motion the ring renders fully drawn with no transition. Remount (key) to replay.
 */
export function SpendDonut({ segments, centerValue, formatAmount }: SpendDonutProps) {
  const [reduced] = useState(prefersReducedMotion)
  const [drawn, setDrawn] = useState(reduced)

  useEffect(() => {
    if (reduced) return
    // Two frames: the first paints the empty ring, so the transition to the
    // real lengths actually runs instead of being folded into first paint.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setDrawn(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [reduced])

  const gap = segments.length > 1 ? GAP : 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true" className="-rotate-90">
          <circle cx="80" cy="80" r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-app-border" />
          {segments.map((s, i) => {
            const length = Math.max(0, s.fraction * CIRCUMFERENCE - gap)
            // Sequential: each segment starts about when the one before it
            // finishes, and takes time in proportion to its size.
            const duration = Math.round(Math.max(260, s.fraction * 900))
            const delay = Math.round(200 + s.offset * 900)
            return (
              <circle
                key={s.label}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                className={segmentColor(s, i).stroke}
                style={{
                  strokeDasharray: `${drawn ? length : 0} ${CIRCUMFERENCE}`,
                  strokeDashoffset: -s.offset * CIRCUMFERENCE,
                  transition: reduced ? undefined : `stroke-dasharray ${duration}ms ${EASE} ${delay}ms`,
                }}
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Spent</span>
          <span className="font-serif text-xl font-semibold tabular-nums text-slate-900">{centerValue}</span>
        </div>
      </div>
      <ul className="stagger-rows flex w-full min-w-0 flex-col gap-2.5 text-sm" aria-label="Spending by category">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              <span aria-hidden="true" className={'h-2.5 w-2.5 shrink-0 rounded-full ' + segmentColor(s, i).bg} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {formatAmount(s.amount)} · {Math.round(s.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
