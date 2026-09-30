import { addDaysISO, dueDatesInRange, type SchedulableItem } from '@/lib/billCalendar'

/** Time-of-day greeting for the Home header: morning before noon, afternoon until 5pm. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Is it their birthday? `dob` and `today` are YYYY-MM-DD; only month and day
 * count. A 29 Feb birthday is on 28 Feb when the year has no 29th (same rule
 * as the server's file_birthday_notifications).
 */
export function isBirthdayToday(dob: string | null | undefined, today: string): boolean {
  if (!dob || dob.length < 10) return false
  const md = dob.slice(5, 10)
  const todayMd = today.slice(5, 10)
  if (md === todayMd) return true
  const year = Number(today.slice(0, 4))
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return md === '02-29' && !leap && todayMd === '02-28'
}

/** First word of a display name ('' when there isn't one). */
export function firstName(displayName: string | null | undefined): string {
  return (displayName ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * An SVG path through `values`, left to right across `width`, scaled so the
 * lowest value sits at `height - pad` and the highest at `pad`. A flat series
 * draws a line through the middle. Empty input gives ''.
 */
export function sparklinePath(values: number[], width: number, height: number, pad = 4): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const usable = height - pad * 2
  const round = (n: number) => Math.round(n * 10) / 10
  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width
    const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * usable
    return [round(x), round(y)] as const
  })
  if (points.length === 1) return `M0 ${points[0][1]} L${width} ${points[0][1]}`
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
}

export interface SpendSegment {
  category: string
  amount: number
  /** Width of this segment as a percentage of the whole bar (0-100). */
  percent: number
}

export interface BudgetSpendSummary {
  /** Spent this month across budgeted categories. */
  spent: number
  /** Sum of the (effective) limits of the budgets passed in. */
  total: number
  /** The top categories by spend, then one "Other" segment for the rest. */
  segments: SpendSegment[]
}

/**
 * This month's spend against the combined limit of the given budgets, broken
 * into a stacked bar: the `top` biggest-spend budgeted categories plus an
 * "Other" segment. Segments are sized against the limit total (so the empty
 * rest of the bar is what's left), or against spend when over, so the bar
 * never overflows. Spending in categories with no budget isn't counted.
 */
export function budgetSpendSummary(
  budgets: { category: string; limit: number }[],
  spentByCategory: Map<string, number>,
  top = 3
): BudgetSpendSummary {
  const total = budgets.reduce((sum, b) => sum + b.limit, 0)
  const rows = budgets
    .map((b) => ({ category: b.category, amount: spentByCategory.get(b.category) ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const spent = rows.reduce((sum, r) => sum + r.amount, 0)
  const scale = Math.max(total, spent)
  const pct = (amount: number) => (scale > 0 ? (amount / scale) * 100 : 0)
  const segments: SpendSegment[] = rows
    .slice(0, top)
    .map((r) => ({ category: r.category, amount: r.amount, percent: pct(r.amount) }))
  const rest = rows.slice(top).reduce((sum, r) => sum + r.amount, 0)
  if (rest > 0) segments.push({ category: 'Other', amount: rest, percent: pct(rest) })
  return { spent, total, segments }
}

export interface DueRow<T> {
  item: T
  date: string
  overdue: boolean
}

/**
 * What's due from `today` through the next `days` days (every projected
 * occurrence), plus each item already overdue (next_date before today) once,
 * soonest first. Same projection the Bills page uses.
 */
export function dueWithin<T extends SchedulableItem>(items: T[], today: string, days = 7): DueRow<T>[] {
  const end = addDaysISO(today, days - 1)
  const rows: DueRow<T>[] = []
  for (const item of items) {
    if (!item.active) continue
    if (item.next_date < today) rows.push({ item, date: item.next_date, overdue: true })
    for (const date of dueDatesInRange(item, today, end)) rows.push({ item, date, overdue: false })
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
