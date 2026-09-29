// Card networks, and which accounts a payment mode can come out of.

import type { AccountKind, CardNetwork, PaymentMethod } from '@/types/database.types'

export const CARD_NETWORKS: CardNetwork[] = ['visa', 'mastercard', 'rupay', 'amex', 'diners', 'other']

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  rupay: 'RuPay',
  amex: 'Amex',
  diners: 'Diners',
  other: 'Other',
}

/** A RuPay credit card can be linked to UPI (NPCI); no other credit card can. */
export function cardSupportsUpi(kind: AccountKind | undefined, network: CardNetwork | null | undefined): boolean {
  return kind === 'credit_card' && network === 'rupay'
}

export interface ModeAccount {
  name: string
  kind: AccountKind | undefined
  network?: CardNetwork | null
}

/**
 * Accounts a payment mode can come out of (user rule):
 * - "Credit card": credit cards only;
 * - "UPI": every non-card account plus RuPay credit cards (UPI on credit);
 * - any other mode: every non-card account.
 * No mode picked: everything. The account already on the entry is the
 * caller's to keep visible.
 */
export function accountsForMode(mode: string | null | undefined, accounts: readonly ModeAccount[]): string[] {
  if (!mode) return accounts.map((a) => a.name)
  if (mode === 'Credit card') return accounts.filter((a) => a.kind === 'credit_card').map((a) => a.name)
  if (mode === 'UPI') {
    return accounts.filter((a) => a.kind !== 'credit_card' || cardSupportsUpi(a.kind, a.network)).map((a) => a.name)
  }
  return accounts.filter((a) => a.kind !== 'credit_card').map((a) => a.name)
}

/** Every payment mode, in picker order (Add entry's Mode pill, Activity's Mode filter). */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI', 'Cash', 'Debit card', 'Credit card', 'Net banking', 'Cheque', 'NEFT/RTGS/IMPS', 'Other',
]
