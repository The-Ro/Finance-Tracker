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
}

/**
 * How last month went for a budget -- informational only. It is shown next to
 * this month's figures but never changes this month's limit or what counts as
 * "over budget" (no carry-forward: there's no month-close event in this app,
 * and the limit's own edit history isn't stored). Returns null when the budget
 * didn't exist yet for any of last month.
 */
export function priorMonthResult(
  monthlyLimit: number,
  budgetCreatedAt: string,
  spentLastMonth: number,
  lastMonth: DateRange
): PriorMonthResult | null {
  if (!lastMonth.start) return null
  // created_at is a timestamp; compare its calendar date against last month's end.
  if (budgetCreatedAt.slice(0, 10) > lastMonth.end) return null
  return { difference: monthlyLimit - spentLastMonth }
}

/**
 * This month's limit for a budget, optionally including last month's unspent
 * amount (opt-in per budget via `rollover`). Only a positive leftover carries
 * over -- overspending never shrinks next month. Last month is measured
 * against the budget's current limit, since limit edit history isn't stored.
 */
export function effectiveLimit(monthlyLimit: number, rollover: boolean, lastMonth: PriorMonthResult | null): number {
  if (!rollover || !lastMonth || lastMonth.difference <= 0) return monthlyLimit
  return monthlyLimit + lastMonth.difference
}
