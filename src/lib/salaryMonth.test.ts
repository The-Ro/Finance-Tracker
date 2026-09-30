import { describe, expect, it } from 'vitest'
import { isSalaryEntry, nextMonthStartIfLate, shiftLateSalary } from './salaryMonth'

const row = (date: string, extra: Partial<{ type: string; category: string | null; tags: string[] }> = {}) => ({
  type: 'income',
  date,
  category: 'Salary',
  tags: [] as string[],
  ...extra,
})

describe('nextMonthStartIfLate', () => {
  it('moves the last 7 days of a month to the next month', () => {
    expect(nextMonthStartIfLate('2026-09-30')).toBe('2026-10-01')
    expect(nextMonthStartIfLate('2026-09-24')).toBe('2026-10-01')
    expect(nextMonthStartIfLate('2026-09-23')).toBeNull()
    expect(nextMonthStartIfLate('2026-12-31')).toBe('2027-01-01')
    expect(nextMonthStartIfLate('2027-02-22')).toBe('2027-03-01')
    expect(nextMonthStartIfLate('2027-02-21')).toBeNull()
  })
})

describe('shiftLateSalary', () => {
  it('only moves salary income, by category or #salary tag', () => {
    const rows = [
      row('2026-09-30'),
      row('2026-09-29', { category: 'Other', tags: ['salary'] }),
      row('2026-09-30', { category: 'Refund' }),
      row('2026-09-30', { type: 'expense', category: 'Salary' }),
      row('2026-09-10'),
    ]
    expect(shiftLateSalary(rows).map((r) => r.date)).toEqual(['2026-10-01', '2026-10-01', '2026-09-30', '2026-09-30', '2026-09-10'])
    expect(rows[0].date).toBe('2026-09-30')
  })
  it('recognises salary entries', () => {
    expect(isSalaryEntry(row('2026-09-30'))).toBe(true)
    expect(isSalaryEntry(row('2026-09-30', { category: 'Bonus' }))).toBe(false)
  })
})
