import type { AccountKind } from '@/lib/creditCards'

/** What the Add account flow asks first. Cash isn't offered: it always exists. */
export type AddAccountType = 'bank' | 'credit' | 'wallet'

/** The type an existing account's section maps to, for opening the flow preselected. */
export function addTypeForKind(kind: AccountKind): AddAccountType {
  if (kind === 'credit_card') return 'credit'
  if (kind === 'cash' || kind === 'wallet') return 'wallet'
  return 'bank'
}

export function defaultDebitCardName(bank: string): string {
  const trimmed = bank.trim()
  return trimmed ? `${trimmed} Debit` : ''
}

/**
 * The cash account that's always kept: the one named "Cash" if it's a cash
 * account, otherwise the first cash account. Null when there's none.
 */
export function permanentCashAccount(accounts: readonly string[], kinds: ReadonlyMap<string, AccountKind>): string | null {
  const cash = accounts.filter((n) => kinds.get(n) === 'cash')
  return cash.find((n) => n.trim().toLowerCase() === 'cash') ?? cash[0] ?? null
}

export const WALLET_SUGGESTIONS = ['Paytm Wallet', 'PhonePe Wallet', 'Amazon Pay', 'Mobikwik'] as const
