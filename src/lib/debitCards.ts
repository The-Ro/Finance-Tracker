import type { Database, PaymentMethod } from '@/types/database.types'

/** A debit card: its own entity, but spends with it come out of `account` (a savings/current account). */
export type DebitCard = Database['public']['Tables']['debit_cards']['Row']

/** "HDFC Millennia ••1234", or just the name without last 4 digits. */
export function debitCardLabel(card: Pick<DebitCard, 'name' | 'last4'>): string {
  return card.last4 ? `${card.name} ••${card.last4}` : card.name
}

/** What choosing this card in Add entry means for the transaction being entered. */
export function selectionForDebitCard(card: Pick<DebitCard, 'id' | 'account'>): {
  account: string
  debitCardId: string
  paymentMethod: PaymentMethod
} {
  return { account: card.account, debitCardId: card.id, paymentMethod: 'Debit card' }
}

/**
 * True for an account whose name says it's a debit card ("HDFC Debit Card"),
 * whatever its kind -- an old name rule may have typed it as a credit card.
 * These were created before debit cards existed and split the real bank
 * account's balance; the UI offers to convert them.
 */
export function looksLikeDebitCardAccount(name: string): boolean {
  return /\bdebit\b/i.test(name)
}

/** Cards grouped under the account they draw from, each list in name order. */
export function debitCardsByAccount(cards: readonly DebitCard[]): Map<string, DebitCard[]> {
  const map = new Map<string, DebitCard[]>()
  for (const card of [...cards].sort((a, b) => a.name.localeCompare(b.name))) {
    map.set(card.account, [...(map.get(card.account) ?? []), card])
  }
  return map
}

/** Normalizes a "last 4 digits" input: digits only, exactly 4, or null when empty. Throws on anything else. */
export function normalizeLast4(input: string | null | undefined): string | null {
  const digits = (input ?? '').replace(/\s+/g, '')
  if (digits === '') return null
  if (!/^\d{4}$/.test(digits)) throw new Error('The last 4 digits must be exactly 4 numbers.')
  return digits
}
