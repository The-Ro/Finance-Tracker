import { describe, expect, it } from 'vitest'
import { effectiveLimit, priorMonthResult, spendByCategory } from '@/lib/budgets'

const sep = { start: '2026-09-01', end: '2026-09-30' }
const aug = { start: '2026-08-01', end: '2026-08-31' }
const mar = { start: '2026-03-01', end: '2026-03-31' }

/** A created_at timestamp for a local wall-clock time, so the tests don't depend on the runner's timezone. */
const localTimestamp = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

describe('spendByCategory', () => {
  it('sums only expenses inside the range, per category', () => {
    const map = spendByCategory(
      [
        { type: 'expense', category: 'Dining', date: '2026-09-02', amount: 10 },
        { type: 'expense', category: 'Dining', date: '2026-09-30', amount: 5 },
        { type: 'expense', category: 'Dining', date: '2026-08-31', amount: 99 },
        { type: 'income', category: 'Salary', date: '2026-09-05', amount: 1000 },
        { type: 'transfer', category: null, date: '2026-09-05', amount: 50 },
      ],
      sep
    )
    expect(Object.fromEntries(map)).toEqual({ Dining: 15 })
  })
})

describe('priorMonthResult', () => {
  it('reports leftover or overspend for a budget that existed last month', () => {
    expect(priorMonthResult(100, localTimestamp(2026, 7, 15, 10), 60, aug)).toEqual({ difference: 40, fullMonth: true })
    expect(priorMonthResult(100, localTimestamp(2026, 8, 31, 23), 130, aug)).toEqual({ difference: -30, fullMonth: false })
  })

  it('returns null for a budget created after last month ended', () => {
    expect(priorMonthResult(100, localTimestamp(2026, 9, 1, 0), 0, aug)).toBeNull()
  })

  it("uses the user's local calendar date, not the UTC date of created_at", () => {
    // Created at 00:30 local on Apr 1 -- in any timezone east of UTC that's still Mar 31 in UTC.
    expect(priorMonthResult(500, localTimestamp(2026, 4, 1, 0, 30), 0, mar)).toBeNull()
  })
})

describe('effectiveLimit', () => {
  it('only carries a leftover from a month the budget existed for from its first day', () => {
    const partial = priorMonthResult(500, localTimestamp(2026, 3, 20, 9), 100, mar)
    expect(effectiveLimit(500, true, partial)).toBe(500)

    const full = priorMonthResult(500, localTimestamp(2026, 2, 10, 9), 100, mar)
    expect(effectiveLimit(500, true, full)).toBe(900)
  })
})
