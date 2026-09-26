import { describe, expect, it } from 'vitest'
import { buildMonthlyReview } from './monthlyReview'
import { effectiveLimit } from './budgets'

const sep = { start: '2026-09-01', end: '2026-09-30' }
const aug = { start: '2026-08-01', end: '2026-08-31' }
const tx = [
  { type: 'income', category: 'Salary', date: '2026-09-01', amount: 1000 },
  { type: 'expense', category: 'Rent', date: '2026-09-02', amount: 500 },
  { type: 'expense', category: 'Dining', date: '2026-09-10', amount: 150 },
  { type: 'transfer', category: null, date: '2026-09-11', amount: 999 },
  { type: 'expense', category: 'Dining', date: '2026-08-10', amount: 100 },
]

describe('buildMonthlyReview', () => {
  it('summarizes the month and ignores transfers', () => {
    const r = buildMonthlyReview(tx, sep, aug, [
      { category: 'Dining', limit: 120 },
      { category: 'Rent', limit: 600 },
    ])
    expect(r.spent).toBe(650)
    expect(r.income).toBe(1000)
    expect(r.keptPercent).toBeCloseTo(35)
    expect(r.spentChange).toBe(550)
    expect(r.categories.map((c) => c.category)).toEqual(['Rent', 'Dining'])
    expect(r.overBudget).toEqual([{ category: 'Dining', over: 30 }])
  })

  it('handles a month with no income or prior month', () => {
    const r = buildMonthlyReview([], sep, null, [])
    expect(r.keptPercent).toBeNull()
    expect(r.spentChange).toBeNull()
  })
})

describe('effectiveLimit', () => {
  it('carries only a positive leftover, and only when enabled', () => {
    expect(effectiveLimit(100, true, { difference: 40 })).toBe(140)
    expect(effectiveLimit(100, true, { difference: -40 })).toBe(100)
    expect(effectiveLimit(100, false, { difference: 40 })).toBe(100)
    expect(effectiveLimit(100, true, null)).toBe(100)
  })
})
