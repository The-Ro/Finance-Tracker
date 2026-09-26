import { monthGrid } from '@/lib/billCalendar'

interface BalanceTransaction {
  type: string
  date: string
  amount: number
}

export interface MonthBalance {
  /** YYYY-MM */
  month: string
  /** Total across all accounts at the end of that month (or today, for the current month). */
  total: number
}

/**
 * Month-end total balance for the last `months` months, derived from starting
 * balances plus logged transactions -- no stored snapshots needed. Transfers
 * move money between the user's own accounts, so they don't change the total.
 */
export function monthEndBalances(
  transactions: BalanceTransaction[],
  openingTotal: number,
  months: number,
  today: string
): MonthBalance[] {
  const [y, m] = today.split('-').map(Number)
  const ends: { month: string; end: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const idx = m - 1 - i
    const year = y + Math.floor(idx / 12)
    const monthIndex = ((idx % 12) + 12) % 12
    const days = monthGrid(year, monthIndex).days
    ends.push({ month: days[0].slice(0, 7), end: days[days.length - 1] })
  }
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1))
  const out: MonthBalance[] = []
  let running = openingTotal
  let i = 0
  for (const { month, end } of ends) {
    while (i < sorted.length && sorted[i].date <= end) {
      const t = sorted[i++]
      if (t.type === 'income') running += t.amount
      else if (t.type === 'expense') running -= t.amount
    }
    out.push({ month, total: Math.round(running * 100) / 100 })
  }
  return out
}
