import { monthGrid } from '@/lib/billCalendar'

interface BalanceTransaction {
  type: string
  date: string
  amount: number
}

export interface MonthBalance {
  /** YYYY-MM */
  month: string
  /**
   * Total across all accounts at the end of that month (or today, for the
   * current month); null for a month that ended before the first logged
   * transaction -- there's no history to show, and repeating the starting
   * balance there would invent one.
   */
  total: number | null
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
  const firstMonth = sorted[0]?.date.slice(0, 7)
  const currentMonth = today.slice(0, 7)
  const out: MonthBalance[] = []
  let running = openingTotal
  let i = 0
  for (const { month, end } of ends) {
    while (i < sorted.length && sorted[i].date <= end) {
      const t = sorted[i++]
      if (t.type === 'income') running += t.amount
      else if (t.type === 'expense') running -= t.amount
    }
    const noHistory = month !== currentMonth && (firstMonth === undefined || month < firstMonth)
    out.push({ month, total: noHistory ? null : Math.round(running * 100) / 100 })
  }
  return out
}
