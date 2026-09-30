import { addDaysISO } from '@/lib/billCalendar'
import { resolvePeriod, type DateRange } from '@/lib/period'

// Budgets normally run by calendar month. With "Start budgets on pay day"
// (user_settings.budget_from_payday) they run from the day the salary arrived
// until the next one: the period starts on the latest logged salary (within
// the last 45 days), or -- before one is logged -- on the set pay day.

export interface BudgetPeriod {
  /** The period now, up to today. */
  current: DateRange
  /** The period before it, whole (rollover and "Last period" use it). */
  previous: DateRange
  /** Stable id for this period (budget alerts are filed once per period). */
  key: string
  fromPayday: boolean
}

function payDayIn(year: number, monthIndex: number, day: number): string {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  const d = Math.min(day, last)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The expected pay day on or before `date` (a 31st clamps to short months). */
function expectedPayDayOnOrBefore(date: string, day: number): string {
  const [y, m] = date.split('-').map(Number)
  const thisMonth = payDayIn(y, m - 1, day)
  return thisMonth <= date ? thisMonth : payDayIn(y, m - 2, day)
}

/**
 * The budget period for `today`. `salaryDates` are the dates of logged salary
 * entries; `salaryDay` the pay day set in Settings -> Salary (1-31, 31 = last
 * day). Calendar month when the option is off or nothing is known about pay.
 */
export function budgetPeriod(opts: { fromPayday: boolean; salaryDay: number | null; salaryDates: string[]; today: string }): BudgetPeriod {
  const { today } = opts
  const month = (): BudgetPeriod => ({
    current: resolvePeriod('this-month', new Date(today + 'T12:00:00')),
    previous: resolvePeriod('last-month', new Date(today + 'T12:00:00')),
    key: today.slice(0, 7),
    fromPayday: false,
  })
  if (!opts.fromPayday) return month()

  const receipts = [...new Set(opts.salaryDates)].filter((d) => d <= today).sort().reverse()
  const recentSince = addDaysISO(today, -45)
  const latest = receipts.find((d) => d >= recentSince)
  const start = latest ?? (opts.salaryDay ? expectedPayDayOnOrBefore(today, opts.salaryDay) : null)
  if (!start) return month()

  // The period before: the salary logged before this one (at least 10 days
  // earlier, within 45 days), else the pay day a month back.
  const earliest = addDaysISO(start, -45)
  const cutoff = addDaysISO(start, -10)
  const before = receipts.find((d) => d <= cutoff && d >= earliest)
  const [y, m, d] = start.split('-').map(Number)
  const previousStart = before ?? payDayIn(y, m - 2, opts.salaryDay ?? d)
  return {
    current: { start, end: today },
    previous: { start: previousStart, end: addDaysISO(start, -1) },
    key: 'pay:' + start,
    fromPayday: true,
  }
}
