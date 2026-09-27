// Pure helpers for onboarding's "Where does your money live?" step.

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The step asks for what an account holds *today*, but what's stored is its
 * opening balance (accounts.opening_balance), which every balance consumer
 * adds on top of the account's logged transactions. So the opening balance to
 * save is today's figure minus whatever the transactions already contribute
 * (current balance minus current opening). For a brand-new account, or one
 * with no transactions yet, that's just `balanceToday`.
 */
export function openingBalanceForToday(balanceToday: number, currentBalance: number, currentOpening: number): number {
  const fromTransactions = currentBalance - currentOpening
  return round2(balanceToday - fromTransactions)
}

/**
 * Finds an existing account by name, ignoring case and surrounding spaces, so
 * typing "hdfc bank" updates the seeded "HDFC Bank" instead of creating a
 * near-duplicate. Returns the stored spelling, or null for a new account.
 */
export function matchAccountName(input: string, accounts: readonly string[]): string | null {
  const needle = input.trim().toLowerCase()
  if (!needle) return null
  return accounts.find((a) => a.trim().toLowerCase() === needle) ?? null
}

/**
 * Parses the "Balance today" field. Empty means 0. Accepts a leading minus
 * (money owed on a card), a Unicode minus sign, and thousands commas.
 * Returns null for anything that isn't a finite number.
 */
export function parseBalance(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/−/g, '-').trim()
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? round2(n) : null
}
