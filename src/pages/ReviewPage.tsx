import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, TriangleAlert, Repeat, TrendingDown, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useMyTransactions } from '@/hooks/useTransactions'
import { applyRollover, useBudgets } from '@/hooks/useBudgets'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useAuth } from '@/context/AuthContext'
import { buildMonthlyReview } from '@/lib/monthlyReview'
import { dueDatesInRange, monthGrid } from '@/lib/billCalendar'
import { todayISO } from '@/lib/format'

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
  const { format } = useFormatCurrency()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: budgets = [] } = useBudgets()
  const { data: recurring = [] } = useRecurringItemsRaw()
  const [month, setMonth] = useState(() => {
    const [y, m] = todayISO().split('-').map(Number)
    return { year: y, index: m - 1 }
  })

  const range = monthRange(month.year, month.index)
  const prior = monthRange(month.index === 0 ? month.year - 1 : month.year, (month.index + 11) % 12)
  const review = useMemo(() => {
    const limits = applyRollover(budgets, transactions)
      .filter((b) => b.active)
      .map((b) => ({ category: b.category, limit: b.monthly_limit }))
    return buildMonthlyReview(transactions, range, prior, limits)
  }, [transactions, budgets, range.start, prior.start]) // eslint-disable-line react-hooks/exhaustive-deps

  const subscriptions = useMemo(
    () =>
      recurring
        .filter((r) => r.kind === 'subscription')
        .reduce((sum, r) => sum + dueDatesInRange(r, range.start, range.end).length * r.amount, 0),
    [recurring, range.start, range.end]
  )

  const spent = useAnimatedNumber(review.spent)
  const shiftMonth = (delta: number) =>
    setMonth(({ year, index }) => {
      const n = index + delta
      return { year: year + Math.floor(n / 12), index: ((n % 12) + 12) % 12 }
    })
  const label = new Date(month.year, month.index, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const isCurrentMonth = range.end >= todayISO()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Monthly review"
        actions={
          <div className="flex items-center gap-1">
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
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="animate-fade-in-up p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Where it went</h3>
          {review.categories.length === 0 ? (
            <p className="text-sm text-slate-500">No spending logged for this month.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {review.categories.slice(0, 6).map((c) => (
                <li key={c.category} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      {format(c.amount)} · {Math.round(c.share)}%
                    </span>
                  </div>
                  <ProgressBar percent={c.share} tone="accent" />
                </li>
              ))}
            </ul>
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
          {review.overBudget.map((b) => (
            <div key={b.category} className="flex items-center gap-3 rounded-xl bg-danger-light p-3 text-sm text-slate-700">
              <TriangleAlert size={18} className="shrink-0 text-danger" />
              <span>
                {b.category} went <strong>{format(b.over)} over</strong> its budget.
              </span>
            </div>
          ))}
          {subscriptions > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <Repeat size={18} className="shrink-0 text-caution" />
              <span>
                Subscriptions due this month come to <strong>{format(subscriptions)}</strong>.
              </span>
            </div>
          )}
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
    </div>
  )
}
