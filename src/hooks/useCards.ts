import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions, type Transaction } from '@/hooks/useTransactions'
import { useAccountDetails, useAccountOpeningBalances } from '@/hooks/useLookupLists'
import {
  cardStatus,
  statementHistory,
  unbilled,
  type AccountDetails,
  type AccountKind,
  type CardStatus,
  type StatementSummary,
} from '@/lib/creditCards'
import { todayISO } from '@/lib/format'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { loanDetailsOf, outstandingPrincipal } from '@/lib/loans'

/** Names of closed accounts -- hidden from pickers, balances, totals and bills (history stays). */
export function useClosedAccounts(): Set<string> {
  const { data } = useAccountDetails()
  return useMemo(() => new Set([...(data ?? new Map()).entries()].filter(([, d]) => d.closed).map(([n]) => n)), [data])
}

/** account name -> kind; accounts missing from the map are savings accounts (DEFAULT_ACCOUNT_KIND). */
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
  const { data: recurring } = useRecurringItemsRaw()
  return useMemo(() => {
    const map = new Map<string, CardStatus>()
    if (!transactions || !details) return map
    const today = todayISO()
    // EMIs on a card (active recurring loan items on it): the loan still to
    // repay stays blocked from the limit, like the bank shows it.
    const locked = new Map<string, number>()
    for (const item of recurring ?? []) {
      const loan = item.active && item.account ? loanDetailsOf(item) : null
      if (!loan || !item.account) continue
      const left = outstandingPrincipal(loan, Number(item.amount), item.cadence, item.next_date)
      if (left > 0) locked.set(item.account, (locked.get(item.account) ?? 0) + left)
    }
    for (const [name, d] of details) {
      if (d.kind !== 'credit_card' || d.closed) continue
      const s = cardStatus(name, openings?.get(name) ?? 0, transactions, d, today)
      const emiLocked = Math.round((locked.get(name) ?? 0) * 100) / 100
      map.set(
        name,
        emiLocked > 0 && s.limit
          ? {
              ...s,
              emiLocked,
              available: Math.round((s.limit - s.owed - emiLocked) * 100) / 100,
              utilization: Math.min(100, ((s.owed + emiLocked) / s.limit) * 100),
            }
          : { ...s, emiLocked }
      )
    }
    return map
  }, [transactions, details, openings, recurring])
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

export interface CardDetail {
  details: AccountDetails
  status: CardStatus
  /** Newest first; empty until the card has statement and due days. */
  history: StatementSummary[]
  /** Spends since the last statement (null without a statement day). */
  unbilled: { since: string; transactions: Transaction[]; total: number } | null
  /** Every transaction touching the card, newest first. */
  transactions: Transaction[]
}

/** Everything the card screen shows for one credit card (closed cards too -- `details.closed` -- so history stays viewable); null while loading or if `account` isn't a credit card. */
export function useCardDetail(account: string | null | undefined): CardDetail | null {
  const { userId } = useAuth()
  const { data: transactions } = useMyTransactions(userId)
  const { data: detailsMap } = useAccountDetails()
  const { data: openings } = useAccountOpeningBalances()
  // The same status Home uses (EMIs on the card hold part of the limit).
  const statuses = useCardStatuses()
  return useMemo(() => {
    if (!account || !transactions || !detailsMap) return null
    const details = detailsMap.get(account)
    if (!details || details.kind !== 'credit_card') return null
    const today = todayISO()
    const opening = openings?.get(account) ?? 0
    return {
      details,
      status: statuses.get(account) ?? cardStatus(account, opening, transactions, details, today),
      history: statementHistory(account, opening, transactions, details, today),
      unbilled: unbilled(account, transactions, details, today),
      transactions: transactions
        .filter((t) => t.account === account || t.to_account === account)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    }
  }, [account, transactions, detailsMap, openings, statuses])
}
