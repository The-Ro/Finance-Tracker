// "Count my salary toward the next month" (Settings -> Salary): a salary paid
// in the last days of a month is really next month's money, so monthly
// summaries (Home's totals, Money kept each month, Monthly review) count it
// there. The entry itself keeps its real date -- Activity, balances, bills and
// exports are unchanged.

/** A salary landing in the last this-many days of its month counts toward the next one. */
export const SALARY_SHIFT_DAYS = 7

interface SalaryRow {
  type: string
  date: string
  category: string | null
  tags: string[]
}

/** Income logged as salary: category "Salary" or the #salary tag (Home's salary prompt logs both). */
export function isSalaryEntry(t: SalaryRow): boolean {
  return t.type === 'income' && (t.category === 'Salary' || t.tags.includes('salary'))
}

/** The 1st of the next month when `date` (YYYY-MM-DD) is in its month's last SALARY_SHIFT_DAYS days, else null. */
export function nextMonthStartIfLate(date: string): string | null {
  const [y, m, d] = date.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  if (d < lastDay - SALARY_SHIFT_DAYS + 1) return null
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

/** Rows for monthly summaries: late-month salary moved to the 1st of the next month (a copy; others untouched). */
export function shiftLateSalary<T extends SalaryRow>(rows: T[]): T[] {
  return rows.map((t) => {
    if (!isSalaryEntry(t)) return t
    const moved = nextMonthStartIfLate(t.date)
    return moved ? { ...t, date: moved } : t
  })
}
