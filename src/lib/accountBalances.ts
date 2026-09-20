import type { TransactionType } from '@/types/database.types'

export interface BalanceTransaction {
  type: TransactionType
  account: string
  to_account: string | null
  amount: number
}

/**
 * Derives account balances from recorded transactions. An opening balance is
 * intentionally not included because accounts do not yet have that concept.
 */
export function calculateAccountBalances(transactions: readonly BalanceTransaction[]): Map<string, number> {
  const balances = new Map<string, number>()
  const adjust = (account: string, delta: number) => balances.set(account, (balances.get(account) ?? 0) + delta)

  for (const transaction of transactions) {
    if (transaction.type === 'income') adjust(transaction.account, transaction.amount)
    else if (transaction.type === 'expense') adjust(transaction.account, -transaction.amount)
    else {
      adjust(transaction.account, -transaction.amount)
      if (transaction.to_account) adjust(transaction.to_account, transaction.amount)
    }
  }

  return balances
}
