import { isWithinRange, type DateRange } from '@/lib/period'
import type { AccountKind } from '@/lib/creditCards'

interface FlowTransaction {
  type: string
  date: string
  amount: number
  account: string
  to_account: string | null
}

export interface AccountFlow {
  account: string
  /** Current balance (all-time: starting balance + every transaction). */
  balance: number
  /** Income into the account plus transfers into it, within the period. */
  moneyIn: number
  /** Spending from the account plus transfers out of it, within the period. */
  moneyOut: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cash flow for the user's savings accounts only (kind "savings", open):
 * current balance plus money in and out during `range`. Transfers count here
 * -- moving money into savings is exactly what this view is for -- unlike the
 * income/spending totals elsewhere, which ignore transfers.
 */
export function savingsAccountFlows(
  transactions: FlowTransaction[],
  balances: Map<string, number>,
  kinds: Map<string, AccountKind>,
  closed: Set<string>,
  range: DateRange
): AccountFlow[] {
  const flows = new Map<string, AccountFlow>()
  for (const [name, kind] of kinds) {
    if (kind !== 'savings' || closed.has(name)) continue
    flows.set(name, { account: name, balance: round2(balances.get(name) ?? 0), moneyIn: 0, moneyOut: 0 })
  }
  for (const t of transactions) {
    if (!isWithinRange(t.date, range)) continue
    const from = flows.get(t.account)
    if (t.type === 'income' && from) from.moneyIn += t.amount
    else if (t.type === 'expense' && from) from.moneyOut += t.amount
    else if (t.type === 'transfer') {
      if (from) from.moneyOut += t.amount
      const to = t.to_account ? flows.get(t.to_account) : undefined
      if (to) to.moneyIn += t.amount
    }
  }
  return [...flows.values()]
    .map((f) => ({ ...f, moneyIn: round2(f.moneyIn), moneyOut: round2(f.moneyOut) }))
    .sort((a, b) => b.balance - a.balance || a.account.localeCompare(b.account))
}
