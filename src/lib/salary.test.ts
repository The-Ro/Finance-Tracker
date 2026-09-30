import { describe, expect, it } from 'vitest'
import { payDate, payDayLabel, salaryPromptDue, shortMonthNote } from './salary'

const config = { amount: 62000, account: 'HDFC Bank', day: 31, confirmedMonth: null }

describe('payDate', () => {
  it('clamps the pay day to short months', () => {
    expect(payDate('2026-02-10', 31)).toBe('2026-02-28')
    expect(payDate('2026-09-05', 1)).toBe('2026-09-01')
  })
})

describe('salaryPromptDue', () => {
  it('asks from pay day on, until answered or logged', () => {
    expect(salaryPromptDue({ ...config, day: 28 }, '2026-09-27', false)).toBeNull()
    expect(salaryPromptDue({ ...config, day: 28 }, '2026-09-28', false)).toEqual({ month: '2026-09', payDate: '2026-09-28' })
    expect(salaryPromptDue({ ...config, day: 28 }, '2026-09-29', true)).toBeNull()
    expect(salaryPromptDue({ ...config, day: 28, confirmedMonth: '2026-09' }, '2026-09-29', false)).toBeNull()
  })
  it('handles a 31st pay day in a 30-day month, and no salary set', () => {
    expect(salaryPromptDue(config, '2026-09-30', false)?.payDate).toBe('2026-09-30')
    expect(salaryPromptDue(null, '2026-09-30', false)).toBeNull()
  })
})

describe('pay day wording', () => {
  it('calls 31 the last day of each month', () => {
    expect(payDayLabel(31)).toBe('the last day of each month')
    expect(payDayLabel(5)).toBe('day 5 of each month')
  })
  it('explains short months only for days some months lack', () => {
    expect(shortMonthNote(5)).toBeNull()
    expect(shortMonthNote(30)).toBe("In months without a 30th (like February), it's the month's last day.")
    expect(shortMonthNote(31)).toMatch(/Sep 30, Feb 28/)
  })
  it('lands the last day on 30, 28 and 29', () => {
    expect(payDate('2026-09-10', 31)).toBe('2026-09-30')
    expect(payDate('2026-02-10', 31)).toBe('2026-02-28')
    expect(payDate('2028-02-10', 31)).toBe('2028-02-29')
  })
})
