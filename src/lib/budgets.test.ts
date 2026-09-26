import { describe, expect, it } from 'vitest'
import { priorMonthResult, spendByCategory } from '@/lib/budgets'

const sep = { start: '2026-09-01', end: '2026-09-30' }
const aug = { start: '2026-08-01', end: '2026-08-31' }

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
    expect(priorMonthResult(100, '2026-07-15T10:00:00Z', 60, aug)).toEqual({ difference: 40 })
    expect(priorMonthResult(100, '2026-08-31T23:00:00Z', 130, aug)).toEqual({ difference: -30 })
  })

  it('returns null for a budget created after last month ended', () => {
    expect(priorMonthResult(100, '2026-09-01T00:00:00Z', 0, aug)).toBeNull()
  })
})
