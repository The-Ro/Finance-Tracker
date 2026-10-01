import clsx from 'clsx'
import { cashFlowLayout, type CashFlowMonth } from '@/lib/cashFlowChart'

/**
 * Review's "Money in and out": money in rises above the line, money out hangs
 * below it, and the dark line joins what you kept each month (in − out, on
 * the same scale -- above the line you kept money, below it you spent more
 * than came in). Each month is a button that switches the review to it.
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
  const { baseline, columns, segments } = cashFlowLayout(months)
  const n = columns.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const pick = columns.find((c) => c.month === selected) ?? null
  const kept = pick ? pick.income - pick.spent : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-slate-800">Money in and out</h3>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-500" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-positive" /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Out
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-0.5 w-3.5 rounded-full bg-current" /> Kept
          </span>
        </div>
      </div>

      <div>
        <div className="relative h-44">
          {/* The line money in and out meet at. */}
          <div className="absolute inset-x-0 border-t border-dashed border-slate-300" style={{ top: `${baseline * 100}%` }} />

          <div className="absolute inset-0 flex">
            {columns.map((c, i) => {
              const isSel = c.month === selected
              const [y, m] = c.month.split('-').map(Number)
              const long = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              return (
                <button
                  key={c.month}
                  type="button"
                  onClick={() => onSelect(c.month)}
                  aria-pressed={isSel}
                  aria-label={c.empty ? `${long}: nothing logged` : `${long}: ${format(c.income)} in, ${format(c.spent)} out`}
                  className="group relative min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    className={clsx(
                      'absolute inset-x-0.5 inset-y-0 rounded-xl transition-colors duration-300',
                      isSel ? 'bg-accent-light/70' : '[@media(hover:hover)]:group-hover:bg-slate-100'
                    )}
                  />
                  {c.empty ? (
                    <span
                      className="absolute left-1/2 h-1 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200"
                      style={{ top: `${baseline * 100}%` }}
                    />
                  ) : (
                    <>
                      <span className="absolute inset-x-0 flex justify-center" style={{ bottom: `${(1 - baseline) * 100}%`, height: `${c.inHeight * 100}%` }}>
                        <span
                          className={clsx(
                            'animate-bar-rise h-full w-[38%] max-w-[26px] rounded-t-md bg-positive transition-opacity duration-300',
                            !isSel && 'opacity-45'
                          )}
                          style={{ animationDelay: `${i * 60}ms` }}
                        />
                      </span>
                      <span className="absolute inset-x-0 flex justify-center" style={{ top: `${baseline * 100}%`, height: `${c.outHeight * 100}%` }}>
                        <span
                          className={clsx(
                            'animate-bar-drop h-full w-[38%] max-w-[26px] rounded-b-md bg-danger transition-opacity duration-300',
                            !isSel && 'opacity-45'
                          )}
                          style={{ animationDelay: `${i * 60 + 40}ms` }}
                        />
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* What you kept, joined month to month. */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full text-slate-700" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {segments
              .filter((s) => s.length > 1)
              .map((s) => (
                <polyline
                  key={s.join('-')}
                  className="animate-line-draw"
                  points={s.map((i) => `${x(i)},${columns[i].keptY * 100}`).join(' ')}
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>
          {columns.map((c, i) =>
            c.empty ? null : (
              <span
                key={c.month}
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x(i)}%`, top: `${c.keptY * 100}%` }}
              >
                <span
                  className={clsx(
                    'animate-pop-in block rounded-full border-2 border-slate-700 bg-app-card transition-all duration-300',
                    c.month === selected ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
                  )}
                  style={{ animationDelay: `${500 + i * 60}ms` }}
                />
              </span>
            )
          )}
        </div>

        <div className="mt-2 flex">
          {columns.map((c) => {
            const [y, m] = c.month.split('-').map(Number)
            const isSel = c.month === selected
            return (
              <span
                key={c.month}
                className={clsx(
                  'flex-1 text-center text-xs',
                  isSel ? 'font-bold text-accent-dark' : c.empty ? 'font-medium text-slate-400' : 'font-medium text-slate-500'
                )}
              >
                {new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' })}
              </span>
            )
          })}
        </div>
      </div>

      {/* The picked month in words. */}
      {pick && (
        <div key={pick.month} className="animate-fade-in grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-white/5">
          <Stat label="In" value={formatCompact(pick.income)} full={format(pick.income)} tone="text-positive" />
          <Stat label="Out" value={formatCompact(pick.spent)} full={format(pick.spent)} tone="text-danger" />
          <Stat
            label={kept < 0 ? 'Spent more' : 'Kept'}
            value={formatCompact(Math.abs(kept))}
            full={format(kept)}
            tone={kept < 0 ? 'text-danger' : 'text-slate-900'}
          />
        </div>
      )}
      <p className="-mt-1 text-helper text-slate-500">Tap a month to review it.</p>
    </div>
  )
}

function Stat({ label, value, full, tone }: { label: string; value: string; full: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col" title={full}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={clsx('truncate font-serif text-lg font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  )
}
