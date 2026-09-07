import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/lib/themeColors'

interface AccountBarChartProps {
  transactions: Transaction[]
}

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

// Beyond this many accounts the chart gets cramped and the label rotation
// stops helping -- show the busiest accounts and note how many are hidden.
const MAX_ACCOUNTS_SHOWN = 8

export function AccountBarChart({ transactions }: AccountBarChartProps) {
  const { format } = useFormatCurrency()
  const { accent, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accent, isDark), [accent, isDark])

  const { data, hiddenCount } = useMemo(() => {
    const byAccount = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue
      if (!byAccount.has(t.account)) byAccount.set(t.account, { income: 0, expense: 0 })
      const bucket = byAccount.get(t.account)!
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    }
    const sorted = Array.from(byAccount.entries())
      .map(([name, v]) => ({ name, income: v.income, expense: v.expense }))
      .sort((a, b) => b.income + b.expense - (a.income + a.expense))
    return { data: sorted.slice(0, MAX_ACCOUNTS_SHOWN), hiddenCount: Math.max(0, sorted.length - MAX_ACCOUNTS_SHOWN) }
  }, [transactions])

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Cash flow by account</h3>
        <p className="text-helper text-slate-500">
          Income against expenses for each account this period
          {hiddenCount > 0 ? ` · ${hiddenCount} more not shown` : ''}.
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No activity yet" description="Add income or expense transactions to compare accounts." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }} barGap={3} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                height={28}
                tick={{ fontSize: 11, fill: colors.tick }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: colors.tick }}
                tickFormatter={(v: number) => compactFormatter.format(v)}
                width={44}
              />
              <Tooltip
                cursor={{ fill: colors.border, opacity: 0.3 }}
                formatter={(value: number) => format(value)}
                contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                labelStyle={{ color: colors.tick, fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: colors.tick }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: colors.tick }} />
              <Bar dataKey="income" name="Income" fill={colors.positive} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" name="Expense" fill={colors.caution} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
