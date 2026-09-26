import { isWithinRange, type DateRange } from '@/lib/period'
import { spendByCategory } from '@/lib/budgets'

interface ReviewTransaction {
  type: string
  category: string | null
  date: string
  amount: number
}

export interface MonthlyReview {
  spent: number
  income: number
  /** Share of income not spent, 0-100; null with no income. */
  keptPercent: number | null
  /** Spend change vs the prior month (positive = spent more); null without a prior month. */
  spentChange: number | null
  categories: { category: string; amount: number; share: number }[]
  overBudget: { category: string; over: number }[]
}

function totals(transactions: ReviewTransaction[], range: DateRange) {
  let spent = 0
  let income = 0
  for (const t of transactions) {
    if (!isWithinRange(t.date, range)) continue
    if (t.type === 'expense') spent += t.amount
    else if (t.type === 'income') income += t.amount
  }
  return { spent, income }
}

/** A month's recap: totals, category mix, budgets exceeded. Transfers are excluded. */
export function buildMonthlyReview(
  transactions: ReviewTransaction[],
  month: DateRange,
  priorMonth: DateRange | null,
  budgets: { category: string; limit: number }[]
): MonthlyReview {
  const { spent, income } = totals(transactions, month)
  const byCategory = spendByCategory(transactions, month)
  const categories = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount, share: spent > 0 ? (amount / spent) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
  const overBudget = budgets
    .map((b) => ({ category: b.category, over: (byCategory.get(b.category) ?? 0) - b.limit }))
    .filter((b) => b.over > 0)
    .sort((a, b) => b.over - a.over)
  return {
    spent,
    income,
    keptPercent: income > 0 ? Math.max(0, ((income - spent) / income) * 100) : null,
    spentChange: priorMonth ? spent - totals(transactions, priorMonth).spent : null,
    categories,
    overBudget,
  }
}
