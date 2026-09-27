import { describe, expect, it } from 'vitest'
import { avatarTone, dayNetTotals, dragOffset, merchantInitial, snapOffset } from './activityList'

describe('dayNetTotals', () => {
  it('adds income, subtracts expenses and skips transfers per day', () => {
    const totals = dayNetTotals([
      { date: '2026-09-27', type: 'expense', amount: 1284 },
      { date: '2026-09-27', type: 'expense', amount: 449 },
      { date: '2026-09-26', type: 'income', amount: 62000 },
      { date: '2026-09-26', type: 'expense', amount: 342 },
      { date: '2026-09-26', type: 'transfer', amount: 5000 },
      { date: '2026-09-25', type: 'transfer', amount: 100 },
    ])
    expect(totals.get('2026-09-27')).toBe(-1733)
    expect(totals.get('2026-09-26')).toBe(61658)
    expect(totals.has('2026-09-25')).toBe(false)
  })
  it('rounds float noise', () => {
    const totals = dayNetTotals([
      { date: '2026-01-01', type: 'income', amount: 0.1 },
      { date: '2026-01-01', type: 'income', amount: 0.2 },
    ])
    expect(totals.get('2026-01-01')).toBe(0.3)
  })
})

describe('merchantInitial', () => {
  it('takes the first letter or digit', () => {
    expect(merchantInitial('fresh mart')).toBe('F')
    expect(merchantInitial('  *Uber')).toBe('U')
    expect(merchantInitial('7-Eleven')).toBe('7')
    expect(merchantInitial('')).toBe('?')
    expect(merchantInitial(null)).toBe('?')
  })
})

describe('avatarTone', () => {
  it('keeps income green and transfers neutral', () => {
    expect(avatarTone('Salary', 'income')).toBe('positive')
    expect(avatarTone(null, 'transfer')).toBe('neutral')
    expect(avatarTone(null, 'expense')).toBe('neutral')
  })
  it('is stable per category and never positive for an expense', () => {
    expect(avatarTone('Groceries', 'expense')).toBe(avatarTone(' groceries ', 'expense'))
    for (const c of ['Dining', 'Travel', 'Rent', 'Shopping', 'Health', 'Fuel']) {
      expect(avatarTone(c, 'expense')).not.toBe('positive')
    }
  })
})

describe('swipe math', () => {
  it('clamps the drag and resists past fully open', () => {
    expect(dragOffset(0, 40, 228)).toBe(0)
    expect(dragOffset(0, -100, 228)).toBe(-100)
    expect(dragOffset(-228, -40, 228)).toBe(-238)
    expect(dragOffset(-228, 300, 228)).toBe(0)
  })
  it('snaps open past a third, or on a flick', () => {
    expect(snapOffset(-50, 228)).toBe(0)
    expect(snapOffset(-80, 228)).toBe(-228)
    expect(snapOffset(-20, 228, -0.8)).toBe(-228)
    expect(snapOffset(-200, 228, 0.8)).toBe(0)
    expect(snapOffset(-50, 0)).toBe(0)
  })
})
