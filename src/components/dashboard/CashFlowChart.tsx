import { useMemo, useState } from 'react'
import { Area, ComposedChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/lib/themeColors'
import { axisTick, gridProps, seriesMotion, tooltipProps } from '@/lib/chartStyle'

interface CashFlowChartProps {
  transactions: Transaction[]
}

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function CashFlowChart({ transactions }: CashFlowChartProps) {
  const { format } = useFormatCurrency()
  const { accentHex, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accentHex, isDark), [accentHex, isDark])

  // Both series show by default; clicking a legend label isolates just that
  // one (or hides it) instead of always showing income and spending
  // stacked together -- recharts doesn't do this itself, so it's tracked here.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const toggleSeries = (dataKey: unknown) => {
    if (typeof dataKey !== 'string') return
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(dataKey)) next.delete(dataKey)
      else next.add(dataKey)
      return next
    })
  }

  const points = useMemo(() => {
    const byMonth = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      // Transfers move money between your own accounts -- they don't change
      // how much you hold overall, so (like income/expense totals elsewhere)
      // they're excluded here too.
      if (t.type !== 'income' && t.type !== 'expense') continue
      const key = t.date.slice(0, 7) // YYYY-MM
      if (!byMonth.has(key)) byMonth.set(key, { income: 0, expense: 0 })
      const bucket = byMonth.get(key)!
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    }
    const sortedKeys = Array.from(byMonth.keys()).sort().slice(-7)
    return sortedKeys.map((key) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
      const bucket = byMonth.get(key)!
      return { label, income: bucket.income, expense: bucket.expense }
    })
  }, [transactions])

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Cash flow</h3>
        <p className="text-helper text-slate-500">
          Last {points.length || 7} months, independent of the period filter above. Click Income or Spending below to isolate it.
        </p>
      </div>
      {points.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No cash flow yet" description="Import or add transactions to see cash flow." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.positive} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.positive} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.danger} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.danger} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick(colors)} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick(colors)}
                tickFormatter={(v: number) => compactFormatter.format(v)}
                width={44}
              />
              <Tooltip
                formatter={(value: number) => format(value)}
                {...tooltipProps(colors)}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: colors.tick, cursor: 'pointer' }}
                onClick={(e) => toggleSeries(e.dataKey)}
                formatter={(value, entry) => (
                  <span style={{ opacity: hidden.has(String(entry.dataKey)) ? 0.4 : 1 }}>{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke={colors.positive}
                fill="url(#incomeGradient)"
                strokeWidth={2.5}
                activeDot={{ r: 4, strokeWidth: 0 }}
                {...seriesMotion(0)}
                name="Income"
                hide={hidden.has('income')}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke={colors.danger}
                fill="url(#expenseGradient)"
                strokeWidth={2.5}
                activeDot={{ r: 4, strokeWidth: 0 }}
                {...seriesMotion(1)}
                name="Spending"
                hide={hidden.has('expense')}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
