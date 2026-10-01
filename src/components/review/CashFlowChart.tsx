import clsx from 'clsx'
import { inOutWidths, keptStrip, type CashFlowMonth } from '@/lib/cashFlowChart'

/**
 * Review's "Money in and out": the picked month in words and two long bars
 * (in vs out, full amounts), then a strip of the last months -- one bar each
 * for what you kept (green up) or overspent (red down). Tap a month to pick it.
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
  const { baseline, bars } = keptStrip(months)
  const pick = bars.find((b) => b.month === selected) ?? null
  const widths = pick ? inOutWidths(pick.income, pick.spent) : { income: 0, spent: 0 }
  const name = (key: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts)
  }

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-sm font-semibold text-slate-800">Money in and out</h3>

      {pick && (
        <div key={pick.month} className="animate-fade-in flex flex-col gap-4">
          <div>
            <p className="text-helper font-medium text-slate-500">{name(pick.month, { month: 'long' })}</p>
            {pick.empty ? (
              <p className="mt-0.5 text-base font-semibold text-slate-500">Nothing logged</p>
            ) : pick.kept >= 0 ? (
              <p className="mt-0.5 font-serif text-2xl font-semibold text-slate-900">
                You kept <span className="text-positive">{format(pick.kept)}</span>
              </p>
            ) : (
              <p className="mt-0.5 font-serif text-2xl font-semibold leading-snug text-slate-900">
                <span className="text-danger">{format(-pick.kept)}</span> more went out than came in
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {[
              { label: 'In', value: pick.income, width: widths.income, tone: 'bg-positive', text: 'text-positive' },
              { label: 'Out', value: pick.spent, width: widths.spent, tone: 'bg-danger', text: 'text-danger' },
            ].map((row, i) => (
              <div key={row.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-600">{row.label}</span>
                  <span className={clsx('font-semibold tabular-nums', row.text)}>{format(row.value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  {row.value > 0 && (
                    <div
                      className={clsx('animate-bar-grow h-full rounded-full', row.tone)}
                      style={{ width: `${Math.max(2, row.width * 100)}%`, animationDelay: `${i * 90}ms` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-app-border pt-4">
        <p className="mb-3 text-helper font-medium text-slate-500">What you kept, last {bars.length} months</p>
        <div className="relative h-24">
          <div className="absolute inset-x-0 border-t border-slate-200 dark:border-white/15" style={{ top: `${baseline * 100}%` }} aria-hidden="true" />
          <div className="absolute inset-0 flex gap-2">
            {bars.map((b, i) => {
              const isSel = b.month === selected
              const long = name(b.month, { month: 'long', year: 'numeric' })
              return (
                <button
                  key={b.month}
                  type="button"
                  onClick={() => onSelect(b.month)}
                  aria-pressed={isSel}
                  aria-label={b.empty ? `${long}: nothing logged` : `${long}: kept ${format(b.kept)}`}
                  className="relative min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {b.empty ? (
                    <span
                      className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300"
                      style={{ top: `${baseline * 100}%` }}
                    />
                  ) : (
                    <span
                      className="absolute inset-x-0 flex justify-center"
                      style={
                        b.kept >= 0
                          ? { bottom: `${(1 - baseline) * 100}%`, height: `${Math.max(3, b.height * 100)}%` }
                          : { top: `${baseline * 100}%`, height: `${Math.max(3, b.height * 100)}%` }
                      }
                    >
                      <span
                        className={clsx(
                          'h-full w-full max-w-[34px] transition-opacity duration-300',
                          b.kept >= 0 ? 'animate-bar-rise rounded-t-lg bg-positive' : 'animate-bar-drop rounded-b-lg bg-danger',
                          !isSel && 'opacity-35'
                        )}
                        style={{ animationDelay: `${i * 60}ms` }}
                      />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          {bars.map((b) => {
            const isSel = b.month === selected
            return (
              <button
                key={b.month}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(b.month)}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <span className={clsx('text-xs', isSel ? 'font-bold text-accent-dark' : 'font-medium text-slate-500')}>
                  {name(b.month, { month: 'short' })}
                </span>
                <span
                  className={clsx(
                    'truncate text-[11px] tabular-nums',
                    b.empty ? 'text-slate-400' : b.kept < 0 ? 'text-danger' : 'text-slate-500',
                    isSel && 'font-semibold'
                  )}
                >
                  {b.empty ? '' : formatCompact(b.kept)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
