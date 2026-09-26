import type { TransactionType } from '@/types/database.types'

export interface BalanceTransaction {
  type: TransactionType
  account: string
  to_account: string | null
  amount: number
}

/**
 * Derives account balances from recorded transactions, starting from each
 * account's opening balance (accounts.opening_balance; missing = 0). Accounts
 * with a non-zero opening balance appear even if they have no transactions.
 */
export function calculateAccountBalances(
  transactions: readonly BalanceTransaction[],
  openingBalances: ReadonlyMap<string, number> = new Map()
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const [account, opening] of openingBalances) {
    if (opening !== 0) balances.set(account, opening)
  }
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
