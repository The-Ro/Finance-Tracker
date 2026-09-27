import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'
import { sparkPath } from '@/lib/sparkPath'
import { AuthRise } from './AuthMotion'

// Decorative lower half of the auth pages' desktop brand panel: three short
// benefit lines, then a sample "Savings flow" card (the dashboard's chart in
// miniature) with two mini cards drifting over its corners. The figures are
// illustrative, not the visitor's data, so the illustration is aria-hidden;
// the benefit lines stay readable.

const BENEFITS = [
  'Every account and card in one ledger',
  'Share with people you trust, on approval',
  'Bills and budgets that keep you ahead',
]

// Six months of sample savings (income minus spending); one dip below zero
// so the chart shows both tones, and the latest month is the high point.
const SAVINGS = [8200, 5400, -1200, 9800, 6100, 15966]
const CHART_W = 360
const CHART_H = 140
const SPARK = sparkPath(SAVINGS, { width: CHART_W, height: CHART_H, padX: 10, padY: 12 })
const AVERAGE = Math.round(SAVINGS.reduce((sum, v) => sum + v, 0) / SAVINGS.length).toLocaleString('en-IN')
const LATEST = SAVINGS[SAVINGS.length - 1].toLocaleString('en-IN')

export function AuthShowcase({ startIndex }: { startIndex: number }) {
  return (
    <div className="flex flex-col gap-10">
      <ul className="flex flex-col gap-3">
        {BENEFITS.map((benefit, i) => (
          <li
            key={benefit}
            className="auth-rise flex items-center gap-3 text-sm font-medium text-accent-on-light"
            style={{ '--auth-i': startIndex + i } as CSSProperties}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-card text-accent-dark shadow-card">
              <Check size={15} strokeWidth={2.5} aria-hidden="true" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="relative max-w-[440px] px-8 pb-10 pt-10">
        <AuthRise index={startIndex + 2}>
          <div className="rounded-card border border-app-border bg-app-card px-5 pb-8 pt-5 shadow-card-lg">
            <p className="text-sm font-semibold text-slate-900">Savings flow</p>
            <p className="text-helper text-slate-500">
              6 months · avg <span className="font-semibold text-slate-700">₹{AVERAGE}</span>
            </p>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="mt-3 h-auto w-full overflow-visible text-positive"
              focusable="false"
            >
              <defs>
                <linearGradient id="auth-savings-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {SPARK.zeroY !== null && (
                <line
                  x1={0}
                  x2={CHART_W}
                  y1={SPARK.zeroY}
                  y2={SPARK.zeroY}
                  className="stroke-app-border"
                  strokeWidth={1.5}
                  strokeDasharray="4 5"
                />
              )}
              <path className="auth-fade" d={SPARK.area} fill="url(#auth-savings-fill)" />
              <path
                className="auth-draw"
                d={SPARK.line}
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {SPARK.points.map((point, i) => {
                const last = i === SPARK.points.length - 1
                return (
                  <circle
                    key={i}
                    className={clsx(
                      'auth-pop',
                      last ? 'fill-positive stroke-app-card' : 'fill-app-card',
                      !last && (point.value < 0 ? 'stroke-danger' : 'stroke-positive')
                    )}
                    style={{ '--auth-i': i } as CSSProperties}
                    cx={point.x}
                    cy={point.y}
                    r={last ? 6.5 : 4.5}
                    strokeWidth={last ? 3 : 2.5}
                  />
                )
              })}
            </svg>
          </div>
        </AuthRise>

        <AuthRise index={startIndex + 4} className="absolute right-0 top-0">
          <div className="auth-drift rounded-2xl border border-app-border bg-app-card px-4 py-3 shadow-card-lg">
            <p className="text-helper text-slate-500">Saved this month</p>
            <p className="font-serif text-lg font-semibold text-positive">+₹{LATEST}</p>
          </div>
        </AuthRise>

        <AuthRise index={startIndex + 5} className="absolute bottom-0 left-0">
          <div className="auth-drift-slow w-44 rounded-2xl border border-app-border bg-app-card px-4 py-3 shadow-card-lg">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-helper text-slate-500">Credit card</p>
              <p className="text-helper font-semibold text-slate-900">21% used</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brass-light">
              <div className="auth-grow h-full w-[21%] rounded-full bg-brass" />
            </div>
          </div>
        </AuthRise>
      </div>
    </div>
  )
}
