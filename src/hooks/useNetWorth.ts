import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAccountBalances, useMyTransactions } from '@/hooks/useTransactions'
import { useAccountKinds, useClosedAccounts } from '@/hooks/useCards'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useIous } from '@/hooks/useIous'
import { useSplits } from '@/hooks/useSplits'
import { useUserSettings } from '@/hooks/useUserSettings'
import { investmentSummary } from '@/lib/investments'
import { summarizeIous } from '@/lib/ious'
import { splitBalances } from '@/lib/splits'
import { loanDetailsOf, outstandingPrincipal } from '@/lib/loans'
import { netWorth, type NetWorth } from '@/lib/netWorth'
import { todayISO } from '@/lib/format'

/**
 * Net worth worked out from the user's own data: account and card balances,
 * money put into investments, Lent & borrowed, unsettled splits and loans
 * still to repay -- plus the "other" totals typed in Settings -> Net worth.
 * Null until the transactions have loaded.
 */
export function useNetWorth(): NetWorth | null {
  const { userId } = useAuth()
  const { data: transactions } = useMyTransactions(userId)
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const closed = useClosedAccounts()
  const { data: recurring } = useRecurringItemsRaw()
  const { data: ious } = useIous()
  const { data: splits } = useSplits()
  const settings = useUserSettings()

  return useMemo(() => {
    if (!transactions) return null
    const today = todayISO()
    const items = recurring ?? []
    const iou = summarizeIous(ious?.records ?? [], ious?.payments ?? [], today)
    const split = splitBalances(splits ?? [], userId ?? '')
    let loansLeft = 0
    for (const item of items) {
      const loan = item.active ? loanDetailsOf(item) : null
      if (loan) loansLeft += outstandingPrincipal(loan, Number(item.amount), item.cadence, item.next_date)
    }
    return netWorth({
      balances,
      kinds,
      closed,
      invested: investmentSummary(transactions, items, today).total,
      lentOut: iou.owedToYou,
      borrowed: iou.youOwe,
      splitsOwedToYou: split.reduce((s, b) => s + b.owedToMe, 0),
      splitsYouOwe: split.reduce((s, b) => s + b.iOwe, 0),
      loansLeft,
      otherAssets: settings.data?.assetsTotal ?? 0,
      otherDebts: settings.data?.liabilitiesTotal ?? 0,
    })
  }, [transactions, balances, kinds, closed, recurring, ious, splits, userId, settings.data?.assetsTotal, settings.data?.liabilitiesTotal])
}
