import { describe, expect, it } from 'vitest'
import { payDate, salaryPromptDue } from './salary'

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
