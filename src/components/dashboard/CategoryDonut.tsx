import { useMemo, useState } from 'react'
import { PieChart as PieIcon } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SpendDonut } from '@/components/review/SpendDonut'
import type { Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { donutSegments } from '@/lib/monthlyReview'
import { activityFilterLink } from '@/lib/activityLink'
import type { DateRange } from '@/lib/period'
import { Link } from 'react-router-dom'

interface CategoryDonutProps {
  transactions: Transaction[]
  /** This period's total income, for the "% of income" line. */
  income: number
  /** The period shown, so a tapped category opens Activity over the same span. */
  range: DateRange
}

/**
 * Home's "Spending by category": the same ring and colours as the Monthly
 * review's "Where it went" (SpendDonut + donutSegments -- top four categories,
 * the rest as "Other"), for the selected period. "See all" lists every
 * category, so nothing hides inside "Other".
 */
export function CategoryDonut({ transactions, income, range }: CategoryDonutProps) {
  const { format, formatCompact } = useFormatCurrency()
  const [showAll, setShowAll] = useState(false)

  const categories = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const name = t.category ?? 'Uncategorised'
      byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount)
    }
    const total = [...byCategory.values()].reduce((sum, v) => sum + v, 0)
    return [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount, share: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions])

  const segments = useMemo(() => donutSegments(categories), [categories])
  const spent = categories.reduce((sum, c) => sum + c.amount, 0)
  const percentOfIncome = income > 0 ? (spent / income) * 100 : null
  // Replay the ring's draw-in whenever the period (and so the data) changes.
  const replayKey = segments.map((s) => `${s.label}:${s.amount}`).join('|')

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold text-slate-800">Spending by category</h3>
        {percentOfIncome !== null && (
          <span className={clsx('text-helper', percentOfIncome > 100 ? 'font-medium text-danger' : 'text-slate-500')}>
            {Math.round(percentOfIncome)}% of {formatCompact(income)} income
          </span>
        )}
      </div>
      {segments.length === 0 ? (
        <EmptyState icon={PieIcon} title="No spending yet" description="Add expense transactions to see the breakdown." />
      ) : (
        <>
          <SpendDonut
            key={replayKey}
            segments={segments}
            centerValue={formatCompact(spent)}
            formatAmount={format}
            linkFor={(category) => activityFilterLink({ category }, range)}
          />
          {segments.some((s) => s.other) && (
            <div className="mt-4 border-t border-app-border pt-1">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="-mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 text-sm font-medium text-accent-dark hover:bg-slate-50"
              >
                <span>{showAll ? 'Show fewer' : `See all ${categories.length} categories`}</span>
              </button>
              {showAll && (
                <ul className="animate-fade-in flex flex-col gap-2 pb-1 text-sm">
                  {categories.map((c) => (
                    <li key={c.category}>
                      <Link
                        to={activityFilterLink({ category: c.category }, range)}
                        className="-mx-2 flex min-h-[36px] items-center justify-between gap-3 rounded-lg px-2 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-50"
                      >
                        <span className="truncate text-slate-700">{c.category}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {format(c.amount)} · {Math.round(c.share)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
