import { describe, expect, it } from 'vitest'
import { buildMonthlyReview, monthlyInOut, donutSegments, subscriptionSummary } from './monthlyReview'
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
    expect(r.prior).toBeNull()
  })

  it("carries the prior month's own totals for the comparison", () => {
    const r = buildMonthlyReview(tx, sep, aug, [])
    expect(r.prior).toEqual({ spent: 100, income: 0, keptPercent: null })
  })

  it('lists budgets under half used, least used first, skipping zero limits', () => {
    const r = buildMonthlyReview(tx, sep, aug, [
      { category: 'Rent', limit: 1200 },
      { category: 'Dining', limit: 300 },
      { category: 'Transport', limit: 3000 },
      { category: 'Gifts', limit: 0 },
    ])
    // Rent 500/1200 = 41.7% -> under; Dining 150/300 = exactly 50% -> not "well under".
    expect(r.underBudget).toEqual([
      { category: 'Transport', spent: 0, limit: 3000, usedPercent: 0 },
      { category: 'Rent', spent: 500, limit: 1200, usedPercent: (500 / 1200) * 100 },
    ])
  })
})

describe('donutSegments', () => {
  const cats = [
    { category: 'Rent', amount: 50 },
    { category: 'Groceries', amount: 20 },
    { category: 'Dining', amount: 10 },
    { category: 'Fuel', amount: 10 },
    { category: 'Gifts', amount: 6 },
    { category: 'Books', amount: 4 },
  ]

  it('keeps the top four and groups the rest as Other, with cumulative offsets', () => {
    const segs = donutSegments(cats)
    expect(segs.map((s) => s.label)).toEqual(['Rent', 'Groceries', 'Dining', 'Fuel', 'Other'])
    expect(segs.map((s) => s.fraction)).toEqual([0.5, 0.2, 0.1, 0.1, 0.1])
    expect(segs[2].offset).toBeCloseTo(0.7)
    expect(segs[4].other).toBe(true)
    const last = segs[segs.length - 1]
    expect(last.offset + last.fraction).toBeCloseTo(1)
  })

  it('names a lone leftover category instead of calling it Other', () => {
    expect(donutSegments(cats.slice(0, 5)).map((s) => s.label)).toEqual(['Rent', 'Groceries', 'Dining', 'Fuel', 'Gifts'])
  })

  it('is empty with no spending', () => {
    expect(donutSegments([])).toEqual([])
    expect(donutSegments([{ category: 'Rent', amount: 0 }])).toEqual([])
  })
})

describe('subscriptionSummary', () => {
  it('totals and counts subscriptions due in the month, ignoring recurring bills and inactive items', () => {
    const items = [
      { kind: 'subscription', amount: 199, active: true, next_date: '2026-09-05', cadence: 'monthly' as const },
      { kind: 'subscription', amount: 50, active: true, next_date: '2026-09-03', cadence: 'weekly' as const },
      { kind: 'subscription', amount: 999, active: true, next_date: '2026-11-01', cadence: 'annual' as const },
      { kind: 'subscription', amount: 10, active: false, next_date: '2026-09-10', cadence: 'monthly' as const },
      { kind: 'recurring', amount: 15000, active: true, next_date: '2026-09-01', cadence: 'monthly' as const },
    ]
    // Weekly from Sep 3: 3, 10, 17, 24 -> 4 x 50.
    expect(subscriptionSummary(items, sep)).toEqual({ total: 199 + 200, count: 2 })
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

describe('buildMonthlyReview budget range', () => {
  it('judges budgets over the pay period when given one', () => {
    const tx = [
      { type: 'expense', category: 'Bike', date: '2026-09-30', amount: 1422.04 },
      { type: 'expense', category: 'Bike', date: '2026-10-01', amount: 0 },
    ]
    const oct = { start: '2026-10-01', end: '2026-10-31' }
    const month = buildMonthlyReview(tx, oct, null, [{ category: 'Bike', limit: 3500 }])
    expect(month.underBudget[0].spent).toBe(0)
    const pay = buildMonthlyReview(tx, oct, null, [{ category: 'Bike', limit: 3500 }], { start: '2026-09-30', end: '2026-10-01' })
    expect(pay.underBudget[0].spent).toBe(1422.04)
    expect(pay.spent).toBe(0)
  })
})

describe('monthlyInOut', () => {
  it('totals money in and out per month, transfers left out, oldest first', () => {
    const tx = [
      { type: 'income', category: 'Salary', date: '2026-09-30', amount: 59000 },
      { type: 'expense', category: 'Dining', date: '2026-09-21', amount: 605 },
      { type: 'transfer', category: null, date: '2026-09-30', amount: 7778 },
      { type: 'expense', category: 'Bike', date: '2026-10-01', amount: 100 },
    ]
    expect(monthlyInOut(tx, 3, '2026-10-01')).toEqual([
      { month: '2026-08', income: 0, spent: 0 },
      { month: '2026-09', income: 59000, spent: 605 },
      { month: '2026-10', income: 0, spent: 100 },
    ])
  })
  it('crosses the new year', () => {
    expect(monthlyInOut([], 2, '2027-01-15').map((r) => r.month)).toEqual(['2026-12', '2027-01'])
  })
})
