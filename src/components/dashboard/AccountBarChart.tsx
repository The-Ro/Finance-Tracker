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
  const { accentHex, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accentHex, isDark), [accentHex, isDark])

  const { data, hiddenCount } = useMemo(() => {
    const byAccount = new Map<string, { income: number; expense: number; transferred: number }>()
    const bucketFor = (account: string) => {
      if (!byAccount.has(account)) byAccount.set(account, { income: 0, expense: 0, transferred: 0 })
      return byAccount.get(account)!
    }
    for (const t of transactions) {
      if (t.type === 'income') bucketFor(t.account).income += t.amount
      else if (t.type === 'expense') bucketFor(t.account).expense += t.amount
      else if (t.type === 'transfer') {
        // Transfers aren't income or spending, so they get their own series
        // rather than being folded into either -- but they were previously
        // skipped entirely, so moving money between your own accounts just
        // never showed up on this chart at all. Both legs of the move count
        // here (money leaving one account, arriving in another), so this
        // reads as "how much activity", not a signed net change.
        bucketFor(t.account).transferred += t.amount
        if (t.to_account) bucketFor(t.to_account).transferred += t.amount
      }
    }
    const sorted = Array.from(byAccount.entries())
      .map(([name, v]) => ({ name, income: v.income, expense: v.expense, transferred: v.transferred }))
      .sort((a, b) => b.income + b.expense + b.transferred - (a.income + a.expense + a.transferred))
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
              <Bar dataKey="transferred" name="Transferred" fill={colors.accent} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
