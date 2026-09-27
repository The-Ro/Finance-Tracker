import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useAccountDetails, useAccountOpeningBalances } from '@/hooks/useLookupLists'
import { cardStatus, type AccountKind, type CardStatus } from '@/lib/creditCards'
import { todayISO } from '@/lib/format'

/** account name -> kind; accounts missing from the map are treated as banks. */
export function useAccountKinds(): Map<string, AccountKind> {
  const { data } = useAccountDetails()
  return useMemo(() => new Map([...(data ?? new Map()).entries()].map(([name, d]) => [name, d.kind])), [data])
}

/** Every credit-card account's position (owed, available, current bill), keyed by name. */
export function useCardStatuses(): Map<string, CardStatus> {
  const { userId } = useAuth()
  const { data: transactions } = useMyTransactions(userId)
  const { data: details } = useAccountDetails()
  const { data: openings } = useAccountOpeningBalances()
  return useMemo(() => {
    const map = new Map<string, CardStatus>()
    if (!transactions || !details) return map
    const today = todayISO()
    for (const [name, d] of details) {
      if (d.kind !== 'credit_card') continue
      map.set(name, cardStatus(name, openings?.get(name) ?? 0, transactions, d, today))
    }
    return map
  }, [transactions, details, openings])
}

export interface CardBill {
  account: string
  dueDate: string
  statementDate: string
  due: number
}

/** Card bills still to pay (amount due > 0), soonest first -- for Bills and Home. */
export function useCardBills(): CardBill[] {
  const statuses = useCardStatuses()
  return useMemo(() => {
    const bills: CardBill[] = []
    for (const [account, s] of statuses) {
      if (s.bill && s.bill.due > 0) {
        bills.push({ account, dueDate: s.bill.dueDate, statementDate: s.bill.statementDate, due: s.bill.due })
      }
    }
    return bills.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
  }, [statuses])
}
