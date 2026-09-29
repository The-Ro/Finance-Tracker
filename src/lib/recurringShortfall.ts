// Which accounts can't cover their recurring payments. Each active item's next
// payment is added up per account, so three bills on one bank show as one
// shortfall ("needs ₹17,478, has ₹1,200") instead of three separate warnings.

export interface ShortfallItem {
  account: string | null
  amount: number
  active: boolean
}

export interface AccountShortfall {
  account: string
  /** Sum of the next payment of every active item on this account. */
  needed: number
  balance: number
  short: number
  count: number
}

/**
 * Accounts whose balance is below the total of their active items' next
 * payments, biggest shortfall first. `isFunded(account)` is false for accounts
 * that aren't "funded" (credit cards): those are never flagged.
 */
export function accountShortfalls(
  items: readonly ShortfallItem[],
  balances: ReadonlyMap<string, number>,
  isFunded: (account: string) => boolean = () => true
): AccountShortfall[] {
  const totals = new Map<string, { needed: number; count: number }>()
  for (const item of items) {
    if (!item.active || !item.account || !isFunded(item.account)) continue
    const t = totals.get(item.account) ?? { needed: 0, count: 0 }
    t.needed += item.amount
    t.count += 1
    totals.set(item.account, t)
  }
  const out: AccountShortfall[] = []
  for (const [account, { needed, count }] of totals) {
    const balance = balances.get(account) ?? 0
    const short = Math.round((needed - balance) * 100) / 100
    if (short > 0) out.push({ account, needed: Math.round(needed * 100) / 100, balance, short, count })
  }
  return out.sort((a, b) => b.short - a.short || a.account.localeCompare(b.account))
}
