import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/lib/themeColors'

interface CashFlowChartProps {
  transactions: Transaction[]
}

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function CashFlowChart({ transactions }: CashFlowChartProps) {
  const { format } = useFormatCurrency()
  const { accent, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accent, isDark), [accent, isDark])

  const points = useMemo(() => {
    const byMonth = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
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
        <p className="text-helper text-slate-500">Last {points.length || 7} months, independent of the period filter above.</p>
      </div>
      {points.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No cash flow yet" description="Import or add transactions to see cash flow." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.caution} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.caution} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.tick }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: colors.tick }}
                tickFormatter={(v: number) => compactFormatter.format(v)}
                width={44}
              />
              <Tooltip
                formatter={(value: number) => format(value)}
                contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                labelStyle={{ color: colors.tick }}
                itemStyle={{ color: colors.tick }}
              />
              <Area type="monotone" dataKey="income" stroke={colors.accent} fill="url(#incomeGradient)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="expense" stroke={colors.caution} fill="url(#expenseGradient)" strokeWidth={2} name="Spending" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
