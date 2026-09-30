import { normalizeMerchant } from '@/lib/merchant'
import { toLocalISODate } from '@/lib/format'

// "Your usual": the entries someone logs again and again, learned from their
// own recent history, offered as one-tap chips at the top of New entry.

export interface UsualSource {
  merchant: string
  category: string | null
  type: string
  date: string
  account: string
  payment_method: string | null
  debit_card_id: string | null
  amount: number
  /** When it was logged (ISO timestamp): used for the time-of-day match. */
  created_at?: string | null
}

export interface UsualEntry {
  merchant: string
  type: string
  category: string | null
  account: string
  paymentMethod: string | null
  debitCardId: string | null
  /** Only when the same amount came up at least twice (a coffee, a recharge). */
  amount: number | null
  score: number
}

const DAY_MS = 86_400_000

/**
 * Merchants logged at least twice in the last `days` days, best first. Each
 * past entry counts more the more recent it is (halves every 30 days), and
 * more again when it fell on the same weekday as `now` or was logged within
 * two hours of the current time of day -- so the morning coffee shows up in
 * the morning and the Saturday groceries on Saturday. The category is the
 * most used one; account, card and mode come from the latest entry.
 */
export function usualEntries(history: UsualSource[], now: Date, opts: { limit?: number; days?: number } = {}): UsualEntry[] {
  const limit = opts.limit ?? 5
  const days = opts.days ?? 90
  const today = toLocalISODate(now)
  const todayMs = Date.parse(today + 'T00:00:00')
  const hour = now.getHours()
  const weekday = now.getDay()

  const groups = new Map<string, UsualSource[]>()
  for (const h of history) {
    if (h.type !== 'expense' && h.type !== 'income') continue
    if (h.date > today) continue
    const age = (todayMs - Date.parse(h.date + 'T00:00:00')) / DAY_MS
    if (age > days) continue
    const key = normalizeMerchant(h.merchant)
    if (!key) continue
    const k = `${h.type}|${key}`
    groups.set(k, [...(groups.get(k) ?? []), h])
  }

  const out: UsualEntry[] = []
  for (const entries of groups.values()) {
    if (entries.length < 2) continue
    entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created_at ?? '').localeCompare(a.created_at ?? '')))
    let score = 0
    const categories = new Map<string, number>()
    const amounts = new Map<number, number>()
    for (const e of entries) {
      const age = (todayMs - Date.parse(e.date + 'T00:00:00')) / DAY_MS
      let w = 0.5 ** (age / 30)
      if (new Date(e.date + 'T00:00:00').getDay() === weekday) w *= 1.5
      if (e.created_at) {
        const h = new Date(e.created_at).getHours()
        const diff = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour))
        if (diff <= 2) w *= 1.5
      }
      score += w
      if (e.category) categories.set(e.category, (categories.get(e.category) ?? 0) + 1)
      amounts.set(e.amount, (amounts.get(e.amount) ?? 0) + 1)
    }
    const latest = entries[0]
    // Most used category; ties go to the latest entry's.
    let category = latest.category
    let best = category ? categories.get(category) ?? 0 : 0
    for (const [c, n] of categories) {
      if (n > best) {
        category = c
        best = n
      }
    }
    let amount: number | null = null
    let amountCount = 1
    // The amount that came up most (at least twice); ties go to the latest entry's.
    for (const [a, n] of amounts) {
      if (n > amountCount || (n === amountCount && n >= 2 && a === latest.amount)) {
        amount = a
        amountCount = n
      }
    }
    out.push({
      merchant: latest.merchant.trim(),
      type: latest.type,
      category,
      account: latest.account,
      paymentMethod: latest.payment_method,
      debitCardId: latest.debit_card_id,
      amount,
      score: Math.round(score * 1000) / 1000,
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}
