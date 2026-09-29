import { merchantsSimilar, normalizeMerchant } from '@/lib/merchant'

interface PastEntry {
  merchant: string
  category: string | null
  type: string
  date: string
}

/**
 * The category most often used for this merchant in the user's own past
 * entries of the same type (ties go to the most recent). Uses the shared
 * tolerant merchant match, so "UBER *TRIP 8812" learns from "Uber trip".
 * Returns null for very short input or when nothing similar exists.
 */
export function suggestCategory(merchant: string, type: string, history: PastEntry[]): string | null {
  if (normalizeMerchant(merchant).length < 3) return null
  const tally = new Map<string, { count: number; latest: string }>()
  for (const h of history) {
    if (h.type !== type || !h.category || !merchantsSimilar(merchant, h.merchant)) continue
    const t = tally.get(h.category) ?? { count: 0, latest: '' }
    tally.set(h.category, { count: t.count + 1, latest: h.date > t.latest ? h.date : t.latest })
  }
  let best: string | null = null
  let bestScore = { count: 0, latest: '' }
  for (const [category, score] of tally) {
    if (score.count > bestScore.count || (score.count === bestScore.count && score.latest > bestScore.latest)) {
      best = category
      bestScore = score
    }
  }
  return best
}

interface PastEntryFull extends PastEntry {
  account: string
  payment_method: string | null
  debit_card_id: string | null
  amount: number
}

export interface EntrySuggestion {
  category: string | null
  account: string | null
  paymentMethod: string | null
  debitCardId: string | null
  /** Only when the last two similar entries were the same amount (a bill, a subscription). */
  amount: number | null
}

/**
 * Everything worth pre-filling from the user's own history for this merchant:
 * the usual category (suggestCategory), and the account, mode and card of the
 * most recent similar entry -- plus the amount when it has repeated exactly.
 * Null when nothing similar exists.
 */
export function suggestEntry(merchant: string, type: string, history: PastEntryFull[]): EntrySuggestion | null {
  if (normalizeMerchant(merchant).length < 3) return null
  const similar = history
    .filter((h) => h.type === type && merchantsSimilar(merchant, h.merchant))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  if (similar.length === 0) return null
  const latest = similar[0]
  const repeated = similar.length >= 2 && similar[0].amount === similar[1].amount ? latest.amount : null
  return {
    category: suggestCategory(merchant, type, history),
    account: latest.account,
    paymentMethod: latest.payment_method,
    debitCardId: latest.debit_card_id,
    amount: repeated,
  }
}
