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
