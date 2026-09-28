import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useAccountCreatedBy, useAccountOpeningBalances, useAccounts } from '@/hooks/useLookupLists'
import { useAccountKinds, useClosedAccounts } from '@/hooks/useCards'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { accountsInUse } from '@/lib/accountGroups'

/**
 * Accounts the user actually uses (see accountsInUse). Pickers show these and
 * tuck the rest -- mostly banks seeded at signup -- behind "Show all". Closed
 * accounts are never in the set (keep a closed account visible yourself when
 * it's the one already on an entry being edited).
 * `ready` is false until every source has loaded, so nothing flickers hidden.
 */
export function useAccountsInUse(): { inUse: Set<string>; ready: boolean } {
  const { userId } = useAuth()
  const { data: accounts } = useAccounts()
  const { data: transactions } = useMyTransactions(userId)
  const { data: openings } = useAccountOpeningBalances()
  const { data: createdBy } = useAccountCreatedBy()
  const { data: debitCards } = useDebitCards()
  const { data: recurring } = useRecurringItemsRaw()
  const kinds = useAccountKinds()
  const closed = useClosedAccounts()

  return useMemo(() => {
    const ready = !!(accounts && transactions && openings && createdBy && debitCards && recurring)
    const inUse = accountsInUse({
      accounts: accounts ?? [],
      transactions: transactions ?? [],
      openingBalances: openings ?? new Map(),
      kinds,
      debitCards: debitCards ?? [],
      recurringAccounts: (recurring ?? []).map((r) => r.account),
      createdBy: createdBy ?? new Map(),
      userId,
      closed,
    })
    return { inUse, ready }
  }, [accounts, transactions, openings, createdBy, debitCards, recurring, kinds, closed, userId])
}
