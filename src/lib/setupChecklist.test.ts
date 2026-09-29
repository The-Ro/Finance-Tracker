import { describe, expect, it } from 'vitest'
import { setupChecklist } from './setupChecklist'
import { roundUpLimit, suggestBudgets } from './budgetSuggestions'

describe('setupChecklist', () => {
  it('lists every item in order with how many are done', () => {
    const r = setupChecklist({ hasAccounts: true, hasBills: false, hasBudget: true, hasGoal: false, hasImport: false, hasSharing: false })
    expect(r.items.map((i) => i.id)).toEqual(['accounts', 'bills', 'budget', 'goal', 'import', 'share'])
    expect(r).toMatchObject({ done: 2, total: 6, complete: false })
  })
  it('is complete when everything is done', () => {
    const all = { hasAccounts: true, hasBills: true, hasBudget: true, hasGoal: true, hasImport: true, hasSharing: true }
    expect(setupChecklist(all).complete).toBe(true)
  })
})

describe('suggestBudgets', () => {
  const tx = (category: string, date: string, amount: number) => ({ type: 'expense', category, date, amount })
  it('suggests the biggest categories from the last three full months, 10% over, rounded up', () => {
    const rows = [
      tx('Groceries', '2026-06-05', 3000), tx('Groceries', '2026-07-05', 3300), tx('Groceries', '2026-08-05', 3600),
      tx('Dining', '2026-08-10', 900),
      tx('Shopping', '2026-09-02', 99999), // this month: not counted
      tx('Rent', '2026-05-01', 18000), // too old
    ]
    const s = suggestBudgets(rows, '2026-09-29', new Set())
    expect(s.map((x) => x.category)).toEqual(['Groceries', 'Dining'])
    expect(s[0]).toEqual({ category: 'Groceries', average: 3300, limit: 4000 })
    expect(s[1]).toEqual({ category: 'Dining', average: 300, limit: 400 })
  })
  it('skips categories that already have a budget, and starts a new user with common ones', () => {
    expect(suggestBudgets([], '2026-09-29', new Set(['Dining']))).toEqual([
      { category: 'Groceries', limit: null, average: 0 },
      { category: 'Shopping', limit: null, average: 0 },
    ])
  })
  it('rounds limits to friendly figures', () => {
    expect(roundUpLimit(330)).toBe(400)
    expect(roundUpLimit(3630)).toBe(4000)
    expect(roundUpLimit(0)).toBe(100)
  })
})
