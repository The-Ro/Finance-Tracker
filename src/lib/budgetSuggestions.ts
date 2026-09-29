// Suggested monthly budgets for the setup checklist: the user's biggest
// expense categories, each with a limit a little above what they've been
// spending. A new user with no history gets common starting categories and
// no amount (they type it). Suggestions only -- nothing is saved until they
// confirm, and categories that already have a budget are skipped.

import { shiftMonth } from '@/lib/savings'

interface SpendTransaction {
  type: string
  date: string
  amount: number
  category: string | null
}

export interface BudgetSuggestion {
  category: string
  /** Suggested limit, or null when there's no history to base it on. */
  limit: number | null
  /** Average monthly spend it's based on (0 without history). */
  average: number
}

export const STARTER_CATEGORIES = ['Groceries', 'Dining', 'Shopping'] as const

/** Round a limit up to a friendly figure: nearest 100 under 1,000, else nearest 500. */
export function roundUpLimit(amount: number): number {
  const step = amount < 1000 ? 100 : 500
  return Math.max(step, Math.ceil(amount / step) * step)
}

/**
 * Top `count` expense categories by average monthly spend over the last
 * `months` full months before today's month, with a limit 10% over that
 * average (rounded up). Falls back to STARTER_CATEGORIES without history.
 */
export function suggestBudgets(
  transactions: SpendTransaction[],
  today: string,
  existing: ReadonlySet<string>,
  { count = 3, months = 3 }: { count?: number; months?: number } = {}
): BudgetSuggestion[] {
  const current = today.slice(0, 7)
  const window = new Set(Array.from({ length: months }, (_, i) => shiftMonth(current, -(i + 1))))
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category || t.category === 'Needs review') continue
    if (!window.has(t.date.slice(0, 7))) continue
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
  }
  const ranked = [...totals.entries()]
    .filter(([category]) => !existing.has(category))
    .map(([category, total]) => ({ category, average: Math.round((total / months) * 100) / 100 }))
    .sort((a, b) => b.average - a.average)
    .slice(0, count)
  if (ranked.length > 0) return ranked.map((r) => ({ ...r, limit: roundUpLimit(r.average * 1.1) }))
  return STARTER_CATEGORIES.filter((c) => !existing.has(c))
    .slice(0, count)
    .map((category) => ({ category, limit: null, average: 0 }))
}
