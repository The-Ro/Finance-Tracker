import clsx from 'clsx'
import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { useAccounts } from '@/hooks/useLookupLists'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

export function AccountBalances() {
  const { userId } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const balances = useAccountBalances(userId)
  const { format } = useFormatCurrency()

  // Only accounts with actual transaction history -- most users have dozens
  // of untouched default bank accounts seeded on signup, and listing all of
  // them at $0 would bury the ones that actually matter.
  const rows = accounts
    .filter((name) => balances.has(name))
    .map((name) => ({ name, balance: balances.get(name)! }))
    .sort((a, b) => b.balance - a.balance)

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Account balances</h3>
        <p className="text-helper text-slate-500">
          Derived from your logged transactions -- not a live bank balance, and doesn't know
          about money already in an account before you started tracking it here.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No account activity yet"
          description="Log a transaction against an account to see its running balance here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-app-border">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between py-2.5 text-sm">
              <span className="min-w-0 truncate pr-3 text-slate-700">{r.name}</span>
              <span
                className={clsx(
                  'shrink-0 font-semibold tabular-nums',
                  r.balance < 0 ? 'text-caution' : 'text-slate-900'
                )}
              >
                {format(r.balance)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
