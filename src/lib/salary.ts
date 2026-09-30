// Salary day: the user sets their salary (amount, account, pay day) and on or
// after that day each month the app asks whether it arrived. Answering Yes
// logs it as income tagged SALARY_TAG; logging it any other way with that tag
// also counts. No cron, so it's asked whenever the app is opened.

export const SALARY_TAG = 'salary'

export interface SalaryConfig {
  amount: number
  account: string
  /** Day of the month, 1-31 (clamped to short months). */
  day: number
  /** YYYY-MM last answered (Yes, or logged). */
  confirmedMonth: string | null
}

const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate()

/** This month's pay date (YYYY-MM-DD) for `day`, clamped to the month's last day. */
export function payDate(today: string, day: number): string {
  const [y, m] = today.split('-').map(Number)
  const d = Math.min(Math.max(1, day), daysIn(y, m))
  return `${today.slice(0, 7)}-${String(d).padStart(2, '0')}`
}

/**
 * Whether to ask "did your salary arrive?" today: salary is set up, pay day
 * has come this month, and this month isn't answered or already logged.
 */
export function salaryPromptDue(
  config: SalaryConfig | null,
  today: string,
  loggedThisMonth: boolean
): { month: string; payDate: string } | null {
  if (!config) return null
  const month = today.slice(0, 7)
  if (config.confirmedMonth === month || loggedThisMonth) return null
  const date = payDate(today, config.day)
  if (today < date) return null
  return { month, payDate: date }
}

/** The day used for "last day of the month" (31 always lands on the month's last day, see payDate). */
export const LAST_DAY = 31

/** Plain words for a pay day: "the last day of each month", or "day 5 of each month". */
export function payDayLabel(day: number): string {
  return day >= LAST_DAY ? 'the last day of each month' : `day ${day} of each month`
}

/** For a day some months don't have (29-30), what happens then; null when every month has it. */
export function shortMonthNote(day: number): string | null {
  if (day >= LAST_DAY) return 'Works for every month: Sep 30, Feb 28 (29 in a leap year), Jan 31.'
  if (day >= 29) return `In months without a ${day}th (like February), it's the month's last day.`
  return null
}
