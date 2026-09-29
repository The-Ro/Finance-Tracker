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

const isBank = (kind: AccountKind | undefined) => kind === undefined || kind === 'savings' || kind === 'current'

/**
 * Accounts a payment mode can come out of (user rules):
 * - "Cash": cash accounts only; "Wallet": wallets only;
 * - "Credit card": credit cards only;
 * - "Debit card": savings/current accounts (Add entry shows the debit cards
 *   themselves instead, see modeUsesDebitCards);
 * - "UPI": banks, wallets and RuPay credit cards (UPI on credit);
 * - "Net banking", "Cheque", "NEFT/RTGS/IMPS": banks only;
 * - no mode or "Other": everything, so any card is one tap away.
 * An unknown kind counts as a bank. The account already on the entry is the
 * caller's to keep visible.
 */
export function accountsForMode(mode: string | null | undefined, accounts: readonly ModeAccount[]): string[] {
  const keep = (test: (a: ModeAccount) => boolean) => accounts.filter(test).map((a) => a.name)
  switch (mode) {
    case null:
    case undefined:
    case '':
    case 'Other':
      return accounts.map((a) => a.name)
    case 'Cash':
      return keep((a) => a.kind === 'cash')
    case 'Wallet':
      return keep((a) => a.kind === 'wallet')
    case 'Credit card':
      return keep((a) => a.kind === 'credit_card')
    case 'UPI':
      return keep((a) => isBank(a.kind) || a.kind === 'wallet' || cardSupportsUpi(a.kind, a.network))
    default:
      return keep((a) => isBank(a.kind))
  }
}

/** Whether debit cards are offered for a mode: none picked, "Debit card" or "Other". */
export function modeUsesDebitCards(mode: string | null | undefined): boolean {
  return !mode || mode === 'Debit card' || mode === 'Other'
}

/** Every payment mode, in picker order (Add entry's Mode pill, Activity's Mode filter). */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI', 'Cash', 'Debit card', 'Credit card', 'Wallet', 'Net banking', 'Cheque', 'NEFT/RTGS/IMPS', 'Other',
]
