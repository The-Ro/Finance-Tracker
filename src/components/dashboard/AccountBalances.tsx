import clsx from 'clsx'
import { CreditCard, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuth } from '@/context/AuthContext'
import { useAccounts } from '@/hooks/useLookupLists'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useAccountKinds, useCardStatuses, useClosedAccounts } from '@/hooks/useCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'

export function AccountBalances() {
  const { userId } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const cards = useCardStatuses()
  const closed = useClosedAccounts()
  const { format } = useFormatCurrency()

  // Only accounts with actual transaction history -- most users have dozens
  // of untouched default bank accounts seeded on signup, and listing all of
  // them at $0 would bury the ones that actually matter.
  const active = accounts.filter((name) => balances.has(name) && !closed.has(name))
  const rows = active
    .filter((name) => kinds.get(name) !== 'credit_card')
    .map((name) => ({ name, balance: balances.get(name)! }))
    .sort((a, b) => b.balance - a.balance)
  const cardRows = active
    .filter((name) => kinds.get(name) === 'credit_card' && cards.has(name))
    .map((name) => ({ name, status: cards.get(name)! }))
    .sort((a, b) => b.status.owed - a.status.owed)

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Account balances</h3>
        <p className="text-helper text-slate-500">
          Each account's starting balance (set in Settings) plus your logged transactions -- not a
          live bank balance.
        </p>
      </div>
      {rows.length === 0 && cardRows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No account activity yet"
          description="Log a transaction against an account to see its running balance here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-app-border">
              {rows.map((r) => (
                <li key={r.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="min-w-0 truncate pr-3 text-slate-700">{r.name}</span>
                  <span
                    className={clsx(
                      'shrink-0 font-semibold tabular-nums',
                      r.balance < 0 ? 'text-danger' : 'text-slate-900'
                    )}
                  >
                    {format(r.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cardRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-helper font-semibold uppercase tracking-wide text-slate-500">Credit cards</p>
              <ul className="flex flex-col divide-y divide-app-border">
                {cardRows.map(({ name, status }) => (
                  <li key={name} className="flex flex-col gap-1.5 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-slate-700">
                        <CreditCard size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{name}</span>
                      </span>
                      <span className={clsx('shrink-0 font-semibold tabular-nums', status.owed > 0 ? 'text-danger' : 'text-slate-900')}>
                        {status.owed > 0 ? `${format(status.owed)} owed` : status.credit > 0 ? `${format(status.credit)} credit` : 'Nothing owed'}
                      </span>
                    </div>
                    {status.utilization !== null && (
                      <ProgressBar percent={status.utilization} tone={status.utilization > 80 ? 'danger' : status.utilization > 50 ? 'caution' : 'positive'} />
                    )}
                    <p className="text-helper text-slate-500">
                      {status.available !== null ? `${format(status.available)} available` : 'Add a credit limit in Settings to see what’s available'}
                      {status.bill && status.bill.due > 0 ? ` · ${format(status.bill.due)} due ${formatShortDate(status.bill.dueDate)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
