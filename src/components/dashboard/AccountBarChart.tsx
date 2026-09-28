import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { useAccountBalances, type Transaction } from '@/hooks/useTransactions'
import { useAccountKinds, useClosedAccounts } from '@/hooks/useCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { savingsAccountFlows } from '@/lib/savingsAccounts'
import type { DateRange } from '@/lib/period'

interface AccountBarChartProps {
  /** Transactions for the whole history; `range` picks the period for in/out. */
  transactions: Transaction[]
  range: DateRange
  /** e.g. "This month" -- shown in the subtitle. */
  periodLabel: string
}

/**
 * Cash flow for savings accounts only: each account's balance, and how much
 * came in and went out this period (transfers included -- moving money into
 * savings is the point). Styled like the Review page's charts: accent bars
 * that grow in, one readable row per account (works at phone width too).
 */
export function AccountBarChart({ transactions, range, periodLabel }: AccountBarChartProps) {
  const { userId } = useAuth()
  const { format, formatCompact } = useFormatCurrency()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const closed = useClosedAccounts()

  const rows = useMemo(
    () => savingsAccountFlows(transactions, balances, kinds, closed, range),
    [transactions, balances, kinds, closed, range]
  )
  const scale = Math.max(1, ...rows.flatMap((r) => [r.moneyIn, r.moneyOut]))
  const totalIn = rows.reduce((s, r) => s + r.moneyIn, 0)
  const totalOut = rows.reduce((s, r) => s + r.moneyOut, 0)

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Savings accounts</h3>
          <p className="text-helper text-slate-500">Balance, and money in and out · {periodLabel.toLowerCase()}</p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-4 text-helper text-slate-600">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent dark:bg-accent-dark" />
              In {formatCompact(totalIn)}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent/40 dark:bg-accent-dark/50" />
              Out {formatCompact(totalOut)}
            </span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings accounts yet"
          description="Mark your bank accounts as Savings in Settings, Accounts, to track them here."
          action={
            <Link to="/settings/accounts" className="text-helper font-medium text-accent-dark hover:underline">
              Open account settings
            </Link>
          }
        />
      ) : (
        <ul className="stagger-rows flex flex-col gap-4">
          {rows.map((r, i) => (
            <li key={r.account} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{r.account}</span>
                <span className={'shrink-0 font-serif text-lg font-semibold tabular-nums ' + (r.balance < 0 ? 'text-danger' : 'text-slate-900')}>
                  {format(r.balance)}
                </span>
              </div>
              {(['in', 'out'] as const).map((kind) => {
                const value = kind === 'in' ? r.moneyIn : r.moneyOut
                return (
                  <div key={kind} className="flex items-center gap-3">
                    <span className="w-8 shrink-0 text-helper text-slate-500">{kind === 'in' ? 'In' : 'Out'}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={
                          'animate-bar-grow h-full rounded-full ' +
                          (kind === 'in' ? 'bg-accent dark:bg-accent-dark' : 'bg-accent/40 dark:bg-accent-dark/50')
                        }
                        style={{ width: `${value > 0 ? Math.max(2, (value / scale) * 100) : 0}%`, animationDelay: `${i * 80}ms` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-helper font-medium tabular-nums text-slate-700">
                      {formatCompact(value)}
                    </span>
                  </div>
                )
              })}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
