import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { lineChartLayout, type CashFlowMonth } from '@/lib/cashFlowChart'

const CHART_H = 168

/**
 * Review's "Money in and out": a smooth green line for money in (with a soft
 * fill) and a red line for money out over the last months, both from zero --
 * nothing goes below the baseline. The picked month gets a guide line, bigger
 * dots and its amounts on top; a month where more went out says so in words.
 * The SVG is drawn at its real pixel width (measured), so it's never stretched.
 */
export function CashFlowChart({
  months,
  selected,
  onSelect,
  format,
  formatCompact,
}: {
  months: CashFlowMonth[]
  selected: string
  onSelect: (month: string) => void
  format: (n: number) => string
  formatCompact: (n: number) => string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(300)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = lineChartLayout(months, width, CHART_H)
  const pickIndex = Math.max(0, months.findIndex((m) => m.month === selected))
  const pick = months[pickIndex] ?? null
  const kept = pick ? pick.income - pick.spent : 0
  const name = (key: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">Money in and out</h3>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full bg-positive" /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full bg-danger" /> Out
          </span>
        </div>
      </div>

      {pick && (
        <div key={pick.month} className="animate-fade-in grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-500">{name(pick.month, { month: 'long' })} · in</p>
            <p className="truncate font-serif text-2xl font-semibold tabular-nums text-positive">{format(pick.income)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Out</p>
            <p className="truncate font-serif text-2xl font-semibold tabular-nums text-danger">{format(pick.spent)}</p>
          </div>
        </div>
      )}

      <div>
        <div ref={boxRef} className="relative" style={{ height: CHART_H }}>
          <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="cashflow-in-fill" x1="0" y1="0" x2="0" y2="1" className="text-positive">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1={layout.midY} x2={width} y2={layout.midY} className="stroke-slate-200 dark:stroke-white/10" strokeDasharray="3 4" />
            <line x1="0" y1={CHART_H - 0.5} x2={width} y2={CHART_H - 0.5} className="stroke-slate-200 dark:stroke-white/15" />
            <line
              x1={layout.xs[pickIndex]}
              y1="0"
              x2={layout.xs[pickIndex]}
              y2={CHART_H}
              className="stroke-accent-dark/30 transition-all duration-300"
              strokeDasharray="3 3"
            />
            <path d={layout.incomeArea} fill="url(#cashflow-in-fill)" className="animate-fade-in" />
            <path d={layout.incomePath} pathLength={1} className="animate-line-draw stroke-positive" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={layout.spentPath}
              pathLength={1}
              className="animate-line-draw stroke-danger"
              style={{ animationDelay: '0.15s' }}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {months.map((m, i) => {
              const big = i === pickIndex
              return (
                <g key={m.month} className="animate-pop-in" style={{ animationDelay: `${450 + i * 50}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle cx={layout.income[i].x} cy={layout.income[i].y} r={big ? 5.5 : 3.5} className="fill-app-card stroke-positive transition-all duration-300" strokeWidth="2.5" />
                  <circle cx={layout.spent[i].x} cy={layout.spent[i].y} r={big ? 5.5 : 3.5} className="fill-app-card stroke-danger transition-all duration-300" strokeWidth="2.5" />
                </g>
              )
            })}
          </svg>
          {/* Half-way value, so the lines have a sense of scale. */}
          <span className="pointer-events-none absolute right-0 text-[11px] text-slate-400" style={{ top: Math.max(0, layout.midY - 16) }}>
            {formatCompact(layout.midValue)}
          </span>
          {/* Each month is a tap target the full height of the chart. */}
          <div className="absolute inset-0 flex">
            {months.map((m) => (
              <button
                key={m.month}
                type="button"
                onClick={() => onSelect(m.month)}
                aria-pressed={m.month === selected}
                aria-label={`${name(m.month, { month: 'long', year: 'numeric' })}: ${format(m.income)} in, ${format(m.spent)} out`}
                className="h-full min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex">
          {months.map((m) => (
            <button
              key={m.month}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(m.month)}
              className={clsx(
                'min-w-0 flex-1 text-center text-xs',
                m.month === selected ? 'font-bold text-accent-dark' : 'font-medium text-slate-500'
              )}
            >
              {name(m.month, { month: 'short' })}
            </button>
          ))}
        </div>
      </div>

      {pick && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5">
          <span className="text-sm text-slate-600">
            {pick.income === 0 && pick.spent === 0 ? 'Nothing logged' : kept >= 0 ? 'You kept' : 'More went out than came in, by'}
          </span>
          <span className={clsx('shrink-0 font-serif text-lg font-semibold tabular-nums', kept >= 0 ? 'text-slate-900' : 'text-danger')}>
            {pick.income === 0 && pick.spent === 0 ? '' : format(Math.abs(kept))}
          </span>
        </div>
      )}
    </div>
  )
}
