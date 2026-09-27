import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { useAccountBalances, type Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/lib/themeColors'
import { axisTick, gridProps, seriesMotion, tooltipProps } from '@/lib/chartStyle'

interface AccountBarChartProps {
  /** Period-filtered -- used for the expense bar. Balance is all-time by
   *  nature (a running total), so it's pulled separately via
   *  useAccountBalances rather than derived from this same filtered set. */
  transactions: Transaction[]
}

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

// Beyond this many accounts the chart gets cramped and the label rotation
// stops helping -- show the busiest accounts and note how many are hidden.
const MAX_ACCOUNTS_SHOWN = 8

export function AccountBarChart({ transactions }: AccountBarChartProps) {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { accentHex, isDark } = useTheme()
  const colors = useMemo(() => getChartTheme(accentHex, isDark), [accentHex, isDark])
  const balances = useAccountBalances(userId)

  const { data, hiddenCount } = useMemo(() => {
    const expenseByAccount = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      expenseByAccount.set(t.account, (expenseByAccount.get(t.account) ?? 0) + t.amount)
    }
    // Every account with either a balance (any transaction history at all)
    // or expense activity this period gets a bar -- not just ones with
    // period-scoped expense, since a balance-only account is still worth
    // seeing here.
    const accountNames = new Set([...balances.keys(), ...expenseByAccount.keys()])
    const sorted = Array.from(accountNames)
      .map((name) => ({ name, balance: balances.get(name) ?? 0, expense: expenseByAccount.get(name) ?? 0 }))
      .sort((a, b) => Math.abs(b.balance) + b.expense - (Math.abs(a.balance) + a.expense))
    return { data: sorted.slice(0, MAX_ACCOUNTS_SHOWN), hiddenCount: Math.max(0, sorted.length - MAX_ACCOUNTS_SHOWN) }
  }, [transactions, balances])

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Cash flow by account</h3>
        <p className="text-helper text-slate-500">
          Current balance against this period's spending, per account
          {hiddenCount > 0 ? ` · ${hiddenCount} more not shown` : ''}.
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No activity yet" description="Add income or expense transactions to compare accounts." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }} barGap={3} barCategoryGap="24%">
              <CartesianGrid {...gridProps(colors)} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                height={28}
                tick={axisTick(colors, 11)}
              />
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
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: colors.tick }} />
              <Bar dataKey="balance" name="Current balance" fill={colors.positive} fillOpacity={0.85} radius={[8, 8, 0, 0]} maxBarSize={28} {...seriesMotion(0)} />
              <Bar dataKey="expense" name="Expense" fill={colors.danger} fillOpacity={0.85} radius={[8, 8, 0, 0]} maxBarSize={28} {...seriesMotion(1)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
