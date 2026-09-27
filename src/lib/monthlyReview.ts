import { isWithinRange, type DateRange } from '@/lib/period'
import { spendByCategory } from '@/lib/budgets'
import { dueDatesInRange, type SchedulableItem } from '@/lib/billCalendar'

interface ReviewTransaction {
  type: string
  category: string | null
  date: string
  amount: number
}

export interface MonthTotals {
  spent: number
  income: number
  /** Share of income not spent, 0-100; null with no income. */
  keptPercent: number | null
}

export interface MonthlyReview extends MonthTotals {
  /** Spend change vs the prior month (positive = spent more); null without a prior month. */
  spentChange: number | null
  /** The prior month's own totals, for "Compare to last month"; null without a prior month. */
  prior: MonthTotals | null
  categories: { category: string; amount: number; share: number }[]
  overBudget: { category: string; over: number }[]
  /** Budgets that used less than UNDER_BUDGET_SHARE of their limit, least used first. */
  underBudget: { category: string; spent: number; limit: number; usedPercent: number }[]
}

/** A budget counts as "well under" when less than this share of its limit was spent. */
export const UNDER_BUDGET_SHARE = 0.5

function totals(transactions: ReviewTransaction[], range: DateRange): MonthTotals {
  let spent = 0
  let income = 0
  for (const t of transactions) {
    if (!isWithinRange(t.date, range)) continue
    if (t.type === 'expense') spent += t.amount
    else if (t.type === 'income') income += t.amount
  }
  return { spent, income, keptPercent: income > 0 ? Math.max(0, ((income - spent) / income) * 100) : null }
}

/** A month's recap: totals, category mix, budgets exceeded and well under. Transfers are excluded. */
export function buildMonthlyReview(
  transactions: ReviewTransaction[],
  month: DateRange,
  priorMonth: DateRange | null,
  budgets: { category: string; limit: number }[]
): MonthlyReview {
  const current = totals(transactions, month)
  const prior = priorMonth ? totals(transactions, priorMonth) : null
  const byCategory = spendByCategory(transactions, month)
  const categories = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount, share: current.spent > 0 ? (amount / current.spent) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
  const overBudget = budgets
    .map((b) => ({ category: b.category, over: (byCategory.get(b.category) ?? 0) - b.limit }))
    .filter((b) => b.over > 0)
    .sort((a, b) => b.over - a.over)
  const underBudget = budgets
    .filter((b) => b.limit > 0)
    .map((b) => {
      const spent = byCategory.get(b.category) ?? 0
      return { category: b.category, spent, limit: b.limit, usedPercent: (spent / b.limit) * 100 }
    })
    .filter((b) => b.usedPercent < UNDER_BUDGET_SHARE * 100)
    .sort((a, b) => a.usedPercent - b.usedPercent || b.limit - a.limit)
  return {
    ...current,
    spentChange: prior ? current.spent - prior.spent : null,
    prior,
    categories,
    overBudget,
    underBudget,
  }
}

export interface DonutSegment {
  label: string
  amount: number
  /** 0-1 share of the total. */
  fraction: number
  /** 0-1 position where this segment starts, clockwise from 12 o'clock. */
  offset: number
  /** True for the grouped "Other" remainder. */
  other: boolean
}

/**
 * Spend-mix donut: the top `maxNamed` categories as their own segments, the
 * rest grouped as one trailing "Other" segment. Expects categories sorted
 * largest first (as buildMonthlyReview returns them).
 */
export function donutSegments(categories: { category: string; amount: number }[], maxNamed = 4): DonutSegment[] {
  const positive = categories.filter((c) => c.amount > 0)
  const total = positive.reduce((sum, c) => sum + c.amount, 0)
  if (total <= 0) return []
  // Don't make an "Other" of a single category -- just show it by name.
  const named = positive.length <= maxNamed + 1 ? positive : positive.slice(0, maxNamed)
  const rest = positive.slice(named.length).reduce((sum, c) => sum + c.amount, 0)
  const raw = named.map((c) => ({ label: c.category, amount: c.amount, other: false }))
  if (rest > 0) raw.push({ label: 'Other', amount: rest, other: true })
  let offset = 0
  return raw.map((s) => {
    const fraction = s.amount / total
    const segment = { ...s, fraction, offset }
    offset += fraction
    return segment
  })
}

interface SubscriptionLike extends SchedulableItem {
  kind: string
}

/** What subscriptions due in `range` come to, and how many distinct subscriptions that is. */
export function subscriptionSummary(
  items: SubscriptionLike[],
  range: { start: string; end: string }
): { total: number; count: number } {
  let total = 0
  let count = 0
  for (const item of items) {
    if (item.kind !== 'subscription') continue
    const due = dueDatesInRange(item, range.start, range.end).length
    if (due === 0) continue
    count++
    total += due * item.amount
  }
  return { total, count }
}
