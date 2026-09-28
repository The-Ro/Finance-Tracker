import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/lib/themeColors'
import { seriesMotion, tooltipProps } from '@/lib/chartStyle'

interface CategoryDonutProps {
  transactions: Transaction[]
  /** This period's total income, for the "% of income spent" center label. */
  income: number
}

const COLORS = ['#6558D3', '#2E7DE5', '#1E9E6B', '#E58A2E', '#C2410C', '#7C3AED', '#0EA5E9', '#DB2777', '#475569']

/** Legend rows shown on phones before "Show all"; wider screens list every category. */
const PHONE_LEGEND_ROWS = 5

export function CategoryDonut({ transactions, income }: CategoryDonutProps) {
  const { format } = useFormatCurrency()
  const [showAll, setShowAll] = useState(false)
  const { accentHex, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accentHex, isDark), [accentHex, isDark])

  const data = useMemo(() => {
    const byCategory = new Map<string, number>()
    let total = 0
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      byCategory.set(t.category!, (byCategory.get(t.category!) ?? 0) + t.amount)
      total += t.amount
    }
    return Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  const totalExpense = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])
  const percentOfIncome = income > 0 ? (totalExpense / income) * 100 : null

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Spending by category</h3>
      {income > 0 && (
        <div className="mb-4 mt-2">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-helper text-slate-500">
            <span>
              Income <span className="font-semibold text-slate-800">{format(income)}</span>
            </span>
            <span className={clsx(percentOfIncome !== null && percentOfIncome > 100 && 'font-medium text-caution')}>
              Spent <span className="font-semibold text-slate-800">{format(totalExpense)}</span>
              {percentOfIncome !== null && ` (${percentOfIncome.toFixed(0)}%)`}
            </span>
          </div>
          {/* Income is the full green bar; spend is the red portion "within
              it" -- a plain two-tone bar rather than the shared ProgressBar
              component, since that only supports one fill color and this
              needs both ends to carry fixed semantic meaning (green =
              income, red = spend) regardless of the app's accent theme. */}
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: colors.positive }}
            role="progressbar"
            aria-valuenow={Math.min(100, Math.max(0, percentOfIncome ?? 0))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, percentOfIncome ?? 0))}%`, backgroundColor: colors.danger }}
            />
          </div>
        </div>
      )}
      {data.length === 0 ? (
        <EmptyState icon={PieIcon} title="No spending yet" description="Add expense transactions to see the breakdown." />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={3} cornerRadius={6} startAngle={90} endAngle={-270} {...seriesMotion(0)}>
                  {data.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} stroke={colors.tooltipBg} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  // Fixed below the chart rather than following the cursor's Y
                  // position -- the donut's hole is small enough that a
                  // cursor-anchored tooltip landed right on top of the center
                  // %/amount label, the two texts overlapping illegibly.
                  position={{ y: 195 }}
                  formatter={(value: number) => format(value)}
                  {...tooltipProps(colors)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-slate-900">
                {percentOfIncome !== null ? `${percentOfIncome.toFixed(0)}%` : format(totalExpense)}
              </span>
              <span className="text-helper text-slate-500">{percentOfIncome !== null ? 'of income' : 'spent'}</span>
            </div>
          </div>
          {/* Capped rather than flex-1: this chart is now a full-width section on
              its own (previously paired with the account chart in a 2-col grid),
              so an uncapped list stretches the row wide enough that
              justify-between pins the amount far away from the category name. */}
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <ul className="flex flex-col gap-2" aria-label="Category legend">
              {data.map((entry, i) => (
                <li
                  key={entry.name}
                  className={clsx(
                    'items-center justify-between gap-2 text-sm',
                    !showAll && i >= PHONE_LEGEND_ROWS ? 'hidden sm:flex' : 'flex'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-helper tabular-nums text-slate-500">
                    {format(entry.value)} · {entry.pct.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
            {data.length > PHONE_LEGEND_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="-mx-2 flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium text-accent-dark hover:bg-slate-100 sm:hidden"
              >
                <span>{showAll ? 'Show fewer' : `${data.length - PHONE_LEGEND_ROWS} more categories`}</span>
                {!showAll && (
                  <span className="text-helper font-normal tabular-nums text-slate-500">
                    {format(data.slice(PHONE_LEGEND_ROWS).reduce((sum, d) => sum + d.value, 0))}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
