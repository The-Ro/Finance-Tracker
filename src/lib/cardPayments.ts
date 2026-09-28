import type { Transaction, UpdateTransactionInput } from '@/hooks/useTransactions'
import { addDaysISO } from '@/lib/billCalendar'
import { looksLikeDebitCardAccount } from '@/lib/debitCards'
import { todayISO } from '@/lib/format'

type PaymentCandidate = Pick<Transaction, 'id' | 'type' | 'account' | 'to_account' | 'merchant' | 'remarks' | 'amount' | 'date'>

/** Only recent expenses are checked, so an old, already-reconciled history doesn't keep resurfacing. */
export const CARD_PAYMENT_LOOKBACK_DAYS = 90
/** A transfer into the card this close to the expense, for the same amount, means the payment is already recorded. */
const ALREADY_PAID_WINDOW_DAYS = 3

export interface CardBillHint {
  account: string
  due: number
  dueDate?: string
}

export interface CardPaymentSuggestion<T extends PaymentCandidate> {
  transaction: T
  /** The card it most likely paid, or null when there's no confident match. */
  card: string | null
  reason: string
}

const PAYMENT_PATTERNS: RegExp[] = [
  /\bcredit\s*card\b/,
  /\bcc\s*(bill|payment|pymt|pmt|paid|dues?)\b/,
  /\bcard\s*(payment|bill|pymt|pmt|dues?|outstanding)\b/,
  // CRED also pays rent, school fees and utilities, so it only counts next to card/bill wording.
  /\bcred\b.*\b(cards?|cc|bill)\b|\b(cards?|cc|bill)\b.*\bcred\b/,
  /billdesk.*\bcards?\b|\bcards?\b.*billdesk/,
  /autopay.*\bcards?\b|\bcards?\b.*autopay/,
]

// Bank charges about a card are real expenses, a "debit card payment" is a purchase, and EMI/offer
// wording ("credit card EMI", "10% off with HDFC credit card") isn't a bill payment either.
const NOT_A_PAYMENT = /\b(fees?|charges?|interest|gst|penalty|late|annual|debit\s*card|emi|loan|offers?|cashback|discount)\b/

// Words that don't tell cards apart, so a merchant mentioning them isn't a match for a particular card.
const GENERIC_TOKENS = new Set([
  'credit', 'card', 'cards', 'bank', 'the', 'of', 'and', 'visa', 'mastercard', 'master', 'rupay', 'amex',
  'platinum', 'gold', 'signature', 'rewards', 'reward', 'select', 'classic', 'my', 'cc',
])

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

function distinctiveTokens(cardName: string): string[] {
  return tokens(cardName).filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t))
}

function amountMatches(amount: number, due: number): boolean {
  return due > 0 && Math.abs(amount - due) <= Math.max(1, due * 0.01)
}

function daysApart(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.abs(Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000))
}

/** Credit cards that can receive a bill payment -- a legacy "… Debit Card" account typed credit_card isn't one. */
export function payableCards(cardAccounts: readonly string[]): string[] {
  return cardAccounts.filter((name) => !looksLikeDebitCardAccount(name))
}

/**
 * The user's own recent expenses (not on a card account) that look like a
 * credit-card bill paid from a bank account. Logging those as expenses
 * double-counts the spending -- the card spends were already expenses -- so
 * each one should be a transfer to the card instead. Detection needs a
 * payment-like phrase; the suggested card comes from a name match, a matching
 * bill amount, or being the only card. An expense is skipped when a transfer
 * into that card (any card, if unknown) for the same amount sits within a few
 * days of it: the payment is already recorded, and converting would count it twice.
 */
export function findCardPaymentExpenses<T extends PaymentCandidate>(
  transactions: readonly T[],
  cardAccounts: readonly string[],
  bills: readonly CardBillHint[] = [],
  today: string = todayISO()
): CardPaymentSuggestion<T>[] {
  const payable = payableCards(cardAccounts)
  if (payable.length === 0) return []
  const anyCard = new Set(cardAccounts)
  const cards = new Set(payable)
  const since = addDaysISO(today, -CARD_PAYMENT_LOOKBACK_DAYS)
  const cardTransfers = transactions.filter((t) => t.type === 'transfer' && t.to_account != null && cards.has(t.to_account))
  const alreadyPaid = (t: T, card: string | null) =>
    cardTransfers.some(
      (p) =>
        (card === null || p.to_account === card) &&
        amountMatches(Number(t.amount), Number(p.amount)) &&
        daysApart(t.date, p.date) <= ALREADY_PAID_WINDOW_DAYS
    )

  const out: CardPaymentSuggestion<T>[] = []
  for (const t of transactions) {
    if (t.type !== 'expense' || anyCard.has(t.account) || t.date < since) continue
    const text = `${t.merchant} ${t.remarks ?? ''}`.toLowerCase()
    if (!PAYMENT_PATTERNS.some((p) => p.test(text)) || NOT_A_PAYMENT.test(text)) continue

    const words = new Set(tokens(text))
    const byName = payable.filter((c) => distinctiveTokens(c).some((tok) => words.has(tok)))
    const byAmount = bills.filter((b) => cards.has(b.account) && amountMatches(t.amount, b.due)).map((b) => b.account)

    let card: string | null = null
    let reason = 'Looks like a credit card bill payment'
    if (byName.length === 1) {
      card = byName[0]
      reason = `Mentions ${card}`
    } else if (byName.length > 1) {
      const both = byName.filter((c) => byAmount.includes(c))
      if (both.length === 1) {
        card = both[0]
        reason = `Mentions ${card} and matches its bill`
      }
    } else if (byAmount.length === 1) {
      card = byAmount[0]
      reason = `Matches ${card}'s bill amount`
    } else if (payable.length === 1) {
      card = payable[0]
      reason = 'Your only credit card'
    }
    if (alreadyPaid(t, card)) continue
    out.push({ transaction: t, card, reason })
  }
  return out
}

/** The update that turns such an expense into a transfer from its bank account to the card. */
export function toCardPaymentUpdate(t: Transaction, card: string): UpdateTransactionInput {
  const method = t.payment_method === 'Debit card' || t.payment_method === 'Credit card' ? null : t.payment_method
  return {
    id: t.id,
    date: t.date,
    merchant: t.merchant,
    category: null,
    amount: Number(t.amount),
    type: 'transfer',
    account: t.account,
    toAccount: card,
    remarks: t.remarks,
    paymentMethod: method,
    debitCardId: null,
    tags: t.tags,
    // Transfers are always home currency (see CLAUDE.md, multi-currency).
    foreign: null,
  }
}
