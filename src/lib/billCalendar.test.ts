import { describe, expect, it } from 'vitest'
import { addDaysISO, dueDatesInRange, monthGrid, totalDueWithin } from './billCalendar'

const monthly = { next_date: '2026-10-01', cadence: 'monthly' as const, active: true, amount: 18000 }
const weekly = { next_date: '2026-09-28', cadence: 'weekly' as const, active: true, amount: 100 }

describe('billCalendar', () => {
  it('adds days across month ends', () => {
    expect(addDaysISO('2026-09-27', 6)).toBe('2026-10-03')
  })

  it('projects occurrences forward from next_date only', () => {
    expect(dueDatesInRange(monthly, '2026-10-01', '2026-12-31')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
    expect(dueDatesInRange(weekly, '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ])
    expect(dueDatesInRange({ ...monthly, active: false }, '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('keeps a 31st-of-the-month bill on the 31st after a short month', () => {
    const endOfMonth = { ...monthly, next_date: '2026-01-31' }
    expect(dueDatesInRange(endOfMonth, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('uses anchor_day when next_date was already clamped by a short month', () => {
    const paidInJanuary = { ...monthly, next_date: '2026-02-28', anchor_day: 31 }
    expect(dueDatesInRange(paidInJanuary, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
    // An anchor that doesn't match next_date (edited outside the trigger) is ignored.
    const inconsistent = { ...monthly, next_date: '2026-02-15', anchor_day: 31 }
    expect(dueDatesInRange(inconsistent, '2026-02-01', '2026-03-31')).toEqual(['2026-02-15', '2026-03-15'])
  })

  it('totals the next N days and counts overdue items once', () => {
    expect(totalDueWithin([monthly, weekly], '2026-09-27', 7)).toBe(18100)
    expect(totalDueWithin([{ ...monthly, next_date: '2026-09-20' }], '2026-09-27', 7)).toBe(18000)
  })

  it('builds a Monday-first grid', () => {
    const g = monthGrid(2026, 9) // October 2026 starts on a Thursday
    expect(g.leading).toBe(3)
    expect(g.days).toHaveLength(31)
    expect(g.days[0]).toBe('2026-10-01')
  })
})
