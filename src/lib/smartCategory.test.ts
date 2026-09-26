import { describe, expect, it } from 'vitest'
import { suggestCategory } from './smartCategory'

const history = [
  { merchant: 'Uber trip', category: 'Transport', type: 'expense', date: '2026-09-01' },
  { merchant: 'UBER *TRIP 88123456', category: 'Transport', type: 'expense', date: '2026-09-05' },
  { merchant: 'Uber trip', category: 'Travel', type: 'expense', date: '2026-09-20' },
  { merchant: 'Fresh Mart', category: 'Groceries', type: 'expense', date: '2026-09-10' },
  { merchant: 'Fresh Mart', category: 'Refunds', type: 'income', date: '2026-09-11' },
]

describe('suggestCategory', () => {
  it('picks the most used category for a similar merchant', () => {
    expect(suggestCategory('uber trip', 'expense', history)).toBe('Transport')
  })
  it('only learns from the same entry type', () => {
    expect(suggestCategory('Fresh Mart', 'income', history)).toBe('Refunds')
    expect(suggestCategory('Fresh Mart', 'expense', history)).toBe('Groceries')
  })
  it('breaks ties by the most recent entry', () => {
    const tie = [
      { merchant: 'Cafe Nero', category: 'Dining', type: 'expense', date: '2026-09-01' },
      { merchant: 'Cafe Nero', category: 'Coffee', type: 'expense', date: '2026-09-02' },
    ]
    expect(suggestCategory('Cafe Nero', 'expense', tie)).toBe('Coffee')
  })
  it('returns null for short or unknown merchants', () => {
    expect(suggestCategory('ub', 'expense', history)).toBeNull()
    expect(suggestCategory('Nowhere Store', 'expense', history)).toBeNull()
  })
})
