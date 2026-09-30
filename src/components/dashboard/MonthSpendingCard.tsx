import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { applyRollover, type Budget } from '@/hooks/useBudgets'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { spendByCategory } from '@/lib/budgets'
import { budgetSpendSummary } from '@/lib/home'
import { useBudgetPeriod } from '@/hooks/useBudgetPeriod'

// Segment fills, biggest spend first; the last is the "Other" bucket. Theme
// tokens rather than fixed hex, so they follow the accent and light/dark.
const SEGMENT_CLASSES = ['bg-accent', 'bg-caution', 'bg-info', 'bg-slate-400']

interface MonthSpendingCardProps {
  budgets: Budget[]
  transactions: { type: string; category: string | null; date: string; amount: number }[]
  /** Also list the top budgets with their own progress (the desktop side column). */
  showBudgets?: boolean
  className?: string
}

/**
 * "September spending": this month's spend in budgeted categories against the
 * combined limit of every active budget (rollover included, same as Budgets),
 * as one stacked bar of the top categories. Renders nothing without budgets.
 */
export function MonthSpendingCard({ budgets, transactions, showBudgets, className }: MonthSpendingCardProps) {
  const { format, formatCompact } = useFormatCurrency()

  const period = useBudgetPeriod()
  const { summary, rows } = useMemo(() => {
    const active = applyRollover(budgets, transactions, period.previous).filter((b) => b.active && b.monthly_limit > 0)
    const spent = spendByCategory(transactions, period.current)
    const summary = budgetSpendSummary(
      active.map((b) => ({ category: b.category, limit: b.monthly_limit })),
      spent
    )
    const rows = active
      .map((b) => {
        const amount = spent.get(b.category) ?? 0
        return { category: b.category, amount, limit: b.monthly_limit, percent: (amount / b.monthly_limit) * 100 }
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
    return { summary, rows }
  }, [budgets, transactions, period])

  if (summary.total <= 0) return null

  // "October spending", or "Spending since Sep 30" when budgets run from pay day.
  const monthName = period.fromPayday ? `Spending ${period.label}` : `${new Date().toLocaleDateString(undefined, { month: 'long' })} spending`
  const over = summary.spent > summary.total

  return (
    <Link
      to="/budgets"
      aria-label={`${monthName}: ${format(summary.spent)} of ${format(summary.total)} budgeted. Open Budgets`}
      className={clsx('group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', className)}
    >
      <Card className="card-interactive flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-1 text-sm font-semibold text-slate-800">
            {monthName}
            <ChevronRight size={14} className="text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </h3>
          <span className={clsx('text-helper tabular-nums', over ? 'font-semibold text-danger' : 'text-slate-500')}>
            {formatCompact(summary.spent)} of {formatCompact(summary.total)}
          </span>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          {summary.segments.map((s, i) => (
            <div
              key={s.category}
              className={clsx('animate-bar-grow h-full', s.category === 'Other' ? SEGMENT_CLASSES[3] : SEGMENT_CLASSES[i])}
              style={{ width: `${s.percent}%`, animationDelay: `${300 + i * 80}ms` }}
            />
          ))}
        </div>

        {summary.segments.length > 0 ? (
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-helper text-slate-600">
            {summary.segments.map((s, i) => (
              <li key={s.category} className="flex items-center gap-1.5">
                <span
                  className={clsx('h-2 w-2 rounded-full', s.category === 'Other' ? SEGMENT_CLASSES[3] : SEGMENT_CLASSES[i])}
                  aria-hidden="true"
                />
                {s.category}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-helper text-slate-500">Nothing spent in budgeted categories yet this month.</p>
        )}

        {showBudgets && rows.length > 0 && (
          <ul className="stagger-rows mt-1 flex flex-col gap-3 border-t border-app-border pt-3">
            {rows.map((r) => (
              <li key={r.category} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-helper">
                  <span className="min-w-0 truncate text-slate-700">{r.category}</span>
                  <span className={clsx('shrink-0 tabular-nums', r.percent > 100 ? 'font-semibold text-danger' : 'text-slate-500')}>
                    {formatCompact(r.amount)} / {formatCompact(r.limit)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={clsx('animate-bar-grow h-full rounded-full', r.percent > 100 ? 'bg-danger' : r.percent >= 90 ? 'bg-caution' : 'bg-accent')}
                    style={{ width: `${Math.min(100, r.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Link>
  )
}
