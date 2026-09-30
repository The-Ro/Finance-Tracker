import { describe, expect, it } from 'vitest'
import { budgetPeriod } from './budgetPeriod'

describe('budgetPeriod', () => {
  it('is the calendar month when the option is off', () => {
    const p = budgetPeriod({ fromPayday: false, salaryDay: 31, salaryDates: ['2026-09-30'], today: '2026-10-05' })
    expect(p).toMatchObject({ current: { start: '2026-10-01', end: '2026-10-05' }, previous: { start: '2026-09-01', end: '2026-09-30' }, key: '2026-10', fromPayday: false })
  })
  it('starts on the day the salary arrived', () => {
    const p = budgetPeriod({ fromPayday: true, salaryDay: 31, salaryDates: ['2026-08-31', '2026-09-30'], today: '2026-10-05' })
    expect(p.current).toEqual({ start: '2026-09-30', end: '2026-10-05' })
    expect(p.previous).toEqual({ start: '2026-08-31', end: '2026-09-29' })
    expect(p.key).toBe('pay:2026-09-30')
  })
  it('keeps the old period going until this month’s salary is logged', () => {
    const p = budgetPeriod({ fromPayday: true, salaryDay: 31, salaryDates: ['2026-09-30'], today: '2026-10-31' })
    expect(p.current.start).toBe('2026-09-30')
  })
  it('uses the set pay day before any salary is logged (clamped to short months)', () => {
    const p = budgetPeriod({ fromPayday: true, salaryDay: 31, salaryDates: [], today: '2026-10-05' })
    expect(p.current.start).toBe('2026-09-30')
    expect(p.previous).toEqual({ start: '2026-08-31', end: '2026-09-29' })
    const mid = budgetPeriod({ fromPayday: true, salaryDay: 5, salaryDates: [], today: '2026-10-05' })
    expect(mid.current.start).toBe('2026-10-05')
  })
  it('falls back to the month without any pay information', () => {
    expect(budgetPeriod({ fromPayday: true, salaryDay: null, salaryDates: [], today: '2026-10-05' }).fromPayday).toBe(false)
  })
})
