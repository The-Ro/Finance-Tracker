import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions, useEveryoneTransactions } from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { ScopeToggle, type TransactionScope } from '@/components/transactions/ScopeToggle'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { resolvePeriod, isWithinRange } from '@/lib/period'

export function TransactionsPage() {
  const { userId } = useAuth()
  const settings = useUserSettings()
  const [scope, setScope] = useState<TransactionScope>('mine')

  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const profiles = useProfiles()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()

  const period = settings.data?.selectedPeriod ?? 'all-time'
  const range = resolvePeriod(period)

  const source = scope === 'mine' ? myTransactions.data ?? [] : everyoneTransactions.data ?? []
  const inPeriod = source.filter((t) => isWithinRange(t.date, range))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeToggle value={scope} onChange={setScope} />
          <PeriodSelector value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
        </div>
      </div>

      <TransactionTable
        transactions={inPeriod}
        scope={scope}
        currentUserId={userId ?? ''}
        profiles={profiles.data ?? {}}
        categories={categories}
        accounts={accounts}
      />
    </div>
  )
}
