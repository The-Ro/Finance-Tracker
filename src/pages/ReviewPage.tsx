import { useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Share2, TriangleAlert, Repeat, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from '@/context/ToastContext'
import { shareText } from '@/lib/share'
import clsx from 'clsx'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SpendDonut } from '@/components/review/SpendDonut'
import { MonthCompare } from '@/components/review/MonthCompare'
import { CashFlowChart } from '@/components/review/CashFlowChart'
import { useMyTransactions } from '@/hooks/useTransactions'
import { applyRollover, useBudgets } from '@/hooks/useBudgets'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useAuth } from '@/context/AuthContext'
import { buildMonthlyReview, donutSegments, monthlyInOut, subscriptionSummary } from '@/lib/monthlyReview'
import { monthGrid } from '@/lib/billCalendar'
import { formatShortDate, todayISO } from '@/lib/format'
import { useBudgetPeriod } from '@/hooks/useBudgetPeriod'
import { activityFilterLink, activityLink } from '@/lib/activityLink'
import { useSalaryShift } from '@/hooks/useSalaryShift'
import { investedBetween } from '@/lib/investments'

function monthRange(year: number, index: number) {
  const { days } = monthGrid(year, index)
  return { start: days[0], end: days[days.length - 1] }
}

/**
 * Monthly review: a recap of one calendar month of the signed-in user's own
 * transactions -- totals, where the money went, budgets exceeded, and what
 * subscriptions cost. Budgets are compared at the current (rolled-over) limit.
 */
export function ReviewPage() {
  const { userId } = useAuth()
  const { format, formatCompact } = useFormatCurrency()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: budgets = [] } = useBudgets()
  // The recap counts a late-month salary toward the next month when that
  // setting is on; month-end balances below stay on real dates.
  const monthly = useSalaryShift(transactions)
  const { data: recurring = [] } = useRecurringItemsRaw()
  // The last 6 months' money in and out (users found the old month-end
  // "what you have after card dues" bars confusing).
  const history = useMemo(() => monthlyInOut(monthly, 6, todayISO()), [monthly])
  const [month, setMonth] = useState(() => {
    const [y, m] = todayISO().split('-').map(Number)
    return { year: y, index: m - 1 }
  })

  const range = monthRange(month.year, month.index)
  const prior = monthRange(month.index === 0 ? month.year - 1 : month.year, (month.index + 11) % 12)
  // This month with "Start budgets on pay day" on: budgets are judged from the
  // pay day, same as the Budgets page (they used to disagree here).
  const budgetPeriod = useBudgetPeriod()
  const payPeriod = range.end >= todayISO() && budgetPeriod.fromPayday ? budgetPeriod : null
  const budgetRange = payPeriod ? payPeriod.current : range
  const review = useMemo(() => {
    const limits = applyRollover(budgets, transactions, payPeriod ? payPeriod.previous : undefined)
      .filter((b) => b.active)
      .map((b) => ({ category: b.category, limit: b.monthly_limit }))
    return buildMonthlyReview(monthly, range, prior, limits, budgetRange)
  }, [monthly, transactions, budgets, range.start, prior.start, payPeriod, budgetRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const subscriptions = useMemo(
    () => subscriptionSummary(recurring, range),
    [recurring, range.start, range.end] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const segments = useMemo(() => donutSegments(review.categories), [review.categories])
  // SIPs and other investments are logged as spending; say how much of it was.
  const invested = useMemo(() => investedBetween(transactions, recurring, range), [transactions, recurring, range.start, range.end]) // eslint-disable-line react-hooks/exhaustive-deps
  const [compare, setCompare] = useState(false)

  const spent = useAnimatedNumber(review.spent)
  const shiftMonth = (delta: number) =>
    setMonth(({ year, index }) => {
      const n = index + delta
      return { year: year + Math.floor(n / 12), index: ((n % 12) + 12) % 12 }
    })
  const label = new Date(month.year, month.index, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const { show } = useToast()
  // Share a short text summary through the device's share sheet (or clipboard).
  const shareSummary = async () => {
    const top = review.categories.slice(0, 3).map((c) => `${c.category} ${format(c.amount)}`).join(', ')
    const text = [
      `My ${label} on LedgeEaze: spent ${format(review.spent)}` +
        (review.keptPercent !== null ? `, kept ${Math.round(review.keptPercent)}% of income.` : '.'),
      top ? `Top spending: ${top}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const result = await shareText(`${label} review`, text)
    if (result === 'copied') show('Summary copied.')
    else if (result === 'failed') show('Could not share the summary.', { tone: 'error' })
  }
  const monthName = new Date(month.year, month.index, 1).toLocaleDateString(undefined, { month: 'long' })
  const priorName = new Date(month.year, month.index - 1, 1).toLocaleDateString(undefined, { month: 'long' })
  const isCurrentMonth = range.end >= todayISO()
  const underBudget = review.underBudget.slice(0, 3)
  const nothingStoodOut =
    (review.spentChange === null || review.spentChange === 0) &&
    review.overBudget.length === 0 &&
    underBudget.length === 0 &&
    subscriptions.total === 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Monthly review"
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Share summary"
              onClick={shareSummary}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <Share2 size={18} />
            </button>
            <button
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[8rem] text-center text-sm font-semibold text-slate-700">{label}</span>
            <button
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      <div className="animate-fade-in-up">
        <p className="text-helper font-semibold uppercase tracking-widest text-accent-dark">
          {isCurrentMonth ? 'So far this month' : `${label} review`}
        </p>
        <h2 className="mt-1 max-w-2xl font-serif text-3xl font-semibold leading-tight text-slate-900">
          You spent {format(spent)}
          {review.keptPercent !== null ? ` and kept ${Math.round(review.keptPercent)}% of what came in.` : '.'}
        </h2>
        {invested > 0 && (
          <Link to="/goals" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-dark">
            Of this, {format(invested)} went into investments
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
        {review.prior && (
          <button
            type="button"
            aria-pressed={compare}
            aria-controls="review-compare"
            onClick={() => setCompare((c) => !c)}
            className={clsx(
              'mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors active:scale-[0.97]',
              compare
                ? 'border-accent bg-accent-light text-accent-on-light'
                : 'border-app-border text-slate-700 hover:border-accent hover:text-accent-dark'
            )}
          >
            Compare to {priorName}
          </button>
        )}
      </div>

      {compare && review.prior && (
        <Card id="review-compare" className="animate-fade-in-up p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {monthName} vs {priorName}
            </h3>
            {isCurrentMonth && <span className="text-helper text-slate-500">{monthName} so far</span>}
          </div>
          <MonthCompare
            current={review}
            prior={review.prior}
            currentLabel={monthName}
            priorLabel={priorName}
            format={format}
          />
        </Card>
      )}

      <Card className="animate-fade-in-up p-5">
        <CashFlowChart
          months={history}
          selected={`${month.year}-${String(month.index + 1).padStart(2, '0')}`}
          onSelect={(key) => {
            const [y, m] = key.split('-').map(Number)
            setMonth({ year: y, index: m - 1 })
          }}
          format={format}
          formatCompact={formatCompact}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="animate-fade-in-up p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Where it went</h3>
          {segments.length === 0 ? (
            <p className="text-sm text-slate-500">No spending logged for this month.</p>
          ) : (
            <>
              <SpendDonut
                key={`${month.year}-${month.index}`}
                segments={segments}
                centerValue={formatCompact(review.spent)}
                formatAmount={format}
                linkFor={(category) => activityFilterLink({ category }, range)}
              />
              {segments.some((s) => s.other) && (
                <details className="mt-4 border-t border-app-border pt-3 text-sm">
                  <summary className="flex min-h-[44px] cursor-pointer items-center font-medium text-accent-dark">
                    All {review.categories.length} categories
                  </summary>
                  <ul className="flex flex-col gap-2 pt-1">
                    {review.categories.map((c) => (
                      <li key={c.category} className="flex justify-between gap-3">
                        <span className="truncate text-slate-700">{c.category}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {format(c.amount)} · {Math.round(c.share)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Card>

        <Card className="animate-fade-in-up flex flex-col gap-3 p-5">
          <h3 className="text-sm font-semibold text-slate-800">What stood out</h3>
          {review.spentChange !== null && review.spentChange !== 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {review.spentChange > 0 ? (
                <TrendingUp size={18} className="shrink-0 text-danger" />
              ) : (
                <TrendingDown size={18} className="shrink-0 text-positive" />
              )}
              <span>
                You spent {format(Math.abs(review.spentChange))} {review.spentChange > 0 ? 'more' : 'less'} than the month before.
              </span>
            </div>
          )}
          {/* Tap a budget line to see its entries in Activity. */}
          {review.overBudget.map((b) => (
            <Link
              key={b.category}
              to={activityLink(b.category, budgetRange)}
              className="press flex items-center gap-3 rounded-xl bg-danger-light p-3 text-sm text-slate-700"
            >
              <TriangleAlert size={18} className="shrink-0 text-danger" />
              <span className="flex-1">
                {b.category} went <strong>{format(b.over)} over</strong> its budget.
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </Link>
          ))}
          {underBudget.map((b) => (
            <Link
              key={b.category}
              to={activityLink(b.category, budgetRange)}
              className="press flex items-center gap-3 rounded-xl bg-positive-light p-3 text-sm text-slate-700"
            >
              <CircleCheck size={18} className="shrink-0 text-positive" />
              <span className="flex-1">
                {b.category} {isCurrentMonth ? 'is at' : 'stayed at'} <strong>{format(b.spent)}</strong>
                {payPeriod && budgetRange.start ? ` since ${formatShortDate(budgetRange.start)}` : isCurrentMonth ? ' so far' : ''}, well under its{' '}
                {format(b.limit)} budget.
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </Link>
          ))}
          {subscriptions.total > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <Repeat size={18} className="shrink-0 text-caution" />
              <span>
                Subscriptions due this month come to <strong>{format(subscriptions.total)}</strong> across{' '}
                {subscriptions.count === 1 ? '1 subscription' : `${subscriptions.count} subscriptions`}.
              </span>
            </div>
          )}
          {nothingStoodOut && <p className="text-sm text-slate-500">Nothing unusual this month.</p>}
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-app-border pt-3 text-sm">
            <div>
              <p className="text-helper text-slate-500">Money in</p>
              <p className="font-serif text-lg font-semibold text-positive">{format(review.income)}</p>
            </div>
            <div>
              <p className="text-helper text-slate-500">Money out</p>
              <p className="font-serif text-lg font-semibold text-danger">{format(review.spent)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Story-style hand-off to the next review screen (canvas InsightsPhone). */}
      <div className="flex justify-end">
        <Link
          to="/goals"
          className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white"
        >
          Next: goals
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
