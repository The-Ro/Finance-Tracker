import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { averageSaved, savingsChartGeometry, type MonthSavings } from '@/lib/savings'
import '@/styles/dashboard.css'

// Room above the highest point for the current-month callout, and below the
// lowest for the point's own radius.
const PAD_TOP = 52
const PAD_BOTTOM = 14

function monthName(month: string, style: 'short' | 'long'): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style })
}

interface SavingsFlowCardProps {
  /** monthlySavings rows, oldest first; the last one is this month. */
  rows: MonthSavings[]
}

/**
 * "Savings flow": what the user kept each month (income minus spending,
 * transfers excluded) over the last six months, as a hand-drawn SVG line
 * rather than a Recharts chart so it can follow the Motion spec's sequence:
 * the line draws itself in, the area fades in underneath, the points pop in
 * one after another (red outline for a month that spent more than it
 * earned), and this month's callout arrives last.
 */
export function SavingsFlowCard({ rows }: SavingsFlowCardProps) {
  const { format, formatCompact } = useFormatCurrency()
  const gradientId = `savings-${useId().replace(/:/g, '')}`

  // Drawn in real pixels at the measured width, so strokes and points keep
  // their size at any card width.
  const hasActivity = rows.some((r) => r.income !== 0 || r.expense !== 0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Re-run when activity first appears: the measured box only exists then.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasActivity])
  const height = width > 0 && width < 480 ? 150 : 220

  const average = useMemo(() => averageSaved(rows), [rows])
  const geometry = useMemo(
    () => (width > 0 ? savingsChartGeometry(rows.map((r) => r.saved), width, height, { padTop: PAD_TOP, padBottom: PAD_BOTTOM }) : null),
    [rows, width, height]
  )
  const current = rows[rows.length - 1]
  const last = geometry?.points[geometry.points.length - 1]
  const signed = (n: number) => `${n < 0 ? '−' : '+'}${format(Math.abs(n))}`

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Savings flow</h3>
          <p className="text-helper text-slate-500">
            What you kept each month: income minus spending. Transfers never count.
          </p>
        </div>
        {average.months > 0 && (
          <p className="text-helper text-slate-500">
            {average.months} month{average.months === 1 ? '' : 's'} · avg{' '}
            <span className={clsx('font-semibold tabular-nums', average.average < 0 ? 'text-danger' : 'text-slate-900')}>
              {average.average < 0 ? '−' : ''}
              {format(Math.abs(average.average))}
            </span>
          </p>
        )}
      </div>

      {!hasActivity ? (
        <EmptyState icon={PiggyBank} title="Nothing to chart yet" description="Log income and spending to see what you keep each month." />
      ) : (
        <>
          <div ref={wrapRef} className="relative w-full" style={{ height }}>
            {geometry && last && current && (
              <>
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible" aria-hidden="true">
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: 'rgb(var(--positive))', stopOpacity: 0.32 }} />
                      <stop offset="100%" style={{ stopColor: 'rgb(var(--positive))', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                  <line
                    x1={0}
                    x2={width}
                    y1={geometry.zeroY}
                    y2={geometry.zeroY}
                    className="stroke-slate-400"
                    strokeWidth={1}
                    strokeDasharray="4 5"
                  />
                  <text x={width} y={geometry.zeroY - 6} textAnchor="end" className="fill-slate-400 text-xs">
                    {format(0)}
                  </text>
                  {geometry.area && <path d={geometry.area} fill={`url(#${gradientId})`} className="dash-area" />}
                  <path
                    d={geometry.line}
                    pathLength={1}
                    fill="none"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="dash-line stroke-positive"
                  />
                  {geometry.points.map((p, i) => {
                    const isCurrent = i === geometry.points.length - 1
                    const negative = p.value < 0
                    return (
                      <circle
                        key={rows[i].month}
                        cx={p.x}
                        cy={p.y}
                        r={isCurrent ? 7 : 5.5}
                        strokeWidth={3}
                        className={clsx(
                          'dash-pt',
                          negative ? 'stroke-danger' : 'stroke-positive',
                          isCurrent ? (negative ? 'fill-danger' : 'fill-positive') : 'fill-app-card'
                        )}
                        style={{ animationDelay: `${420 + i * 200}ms` }}
                      />
                    )
                  })}
                </svg>
                {/* This month's callout, anchored above its point and kept inside the card. */}
                <div
                  aria-hidden="true"
                  className="dash-tip pointer-events-none absolute flex flex-col items-center rounded-xl border border-app-border bg-app-card px-3 py-1.5 shadow-card"
                  style={{ right: Math.max(0, width - last.x - 16), top: Math.max(0, last.y - 50) }}
                >
                  <span className="text-xs leading-tight text-slate-500">{monthName(current.month, 'long')}</span>
                  <span
                    className={clsx(
                      'font-serif text-sm font-bold leading-tight tabular-nums',
                      current.saved < 0 ? 'text-danger' : 'text-positive'
                    )}
                  >
                    {signed(current.saved)}
                  </span>
                </div>
              </>
            )}
          </div>
          <ul
            className="grid text-center text-helper text-slate-500"
            style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
          >
            {rows.map((r, i) => {
              const isCurrent = i === rows.length - 1
              return (
                <li key={r.month} className="flex min-w-0 flex-col leading-snug">
                  <span className={clsx(isCurrent && 'font-semibold text-slate-800')}>
                    <span aria-hidden="true">{monthName(r.month, 'short')}</span>
                    <span className="sr-only">{monthName(r.month, 'long')}: </span>
                  </span>
                  <span
                    className={clsx(
                      'truncate font-semibold tabular-nums',
                      r.saved < 0 ? 'text-danger' : isCurrent ? 'text-positive' : 'text-slate-800'
                    )}
                  >
                    {r.saved < 0 ? '−' : ''}
                    {formatCompact(Math.abs(r.saved))}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
