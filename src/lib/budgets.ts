import { toLocalISODate } from '@/lib/format'
import { isWithinRange, type DateRange } from '@/lib/period'

interface SpendableTransaction {
  type: string
  category: string | null
  date: string
  amount: number
}

/** Total expense per category within `range`. */
export function spendByCategory(transactions: SpendableTransaction[], range: DateRange): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category || !isWithinRange(t.date, range)) continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return map
}

export interface PriorMonthResult {
  /** limit - spent; positive = left over, negative = overspent. */
  difference: number
  /** False when the budget was created partway through last month. */
  fullMonth?: boolean
}

/**
 * How last month went for a budget, shown next to this month's figures.
 * Returns null when the budget didn't exist yet for any of last month.
 */
export function priorMonthResult(
  monthlyLimit: number,
  budgetCreatedAt: string,
  spentLastMonth: number,
  lastMonth: DateRange
): PriorMonthResult | null {
  if (!lastMonth.start) return null
  // created_at is a UTC timestamp; its calendar date is the user's local one
  // (slicing the ISO string gave the UTC date -- the previous day for IST users
  // creating a budget just after midnight).
  const createdOn = toLocalISODate(new Date(budgetCreatedAt))
  if (createdOn > lastMonth.end) return null
  return { difference: monthlyLimit - spentLastMonth, fullMonth: createdOn <= lastMonth.start }
}

/**
 * This month's limit for a budget, optionally including last month's unspent
 * amount (opt-in per budget via `rollover`). Only a positive leftover carries
 * over -- overspending never shrinks next month -- and only from a month the
 * budget existed for from its first day, or a budget made on the 30th would
 * carry a whole month's limit. Last month is measured against the budget's
 * current limit, since limit edit history isn't stored.
 */
export function effectiveLimit(monthlyLimit: number, rollover: boolean, lastMonth: PriorMonthResult | null): number {
  if (!rollover || !lastMonth || lastMonth.fullMonth === false || lastMonth.difference <= 0) return monthlyLimit
  return monthlyLimit + lastMonth.difference
}
