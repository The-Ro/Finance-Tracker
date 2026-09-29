import { describe, expect, it } from 'vitest'
import { suggestCategory, suggestEntry } from './smartCategory'

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

describe('suggestEntry', () => {
  const e = (merchant: string, date: string, over: Partial<{ category: string; account: string; payment_method: string | null; amount: number; type: string }> = {}) => ({
    merchant,
    date,
    type: 'expense',
    category: 'Dining',
    account: 'HDFC Bank',
    payment_method: 'UPI' as string | null,
    debit_card_id: null,
    amount: 250,
    ...over,
  })
  it('takes the account and mode from the latest similar entry, and a repeated amount', () => {
    const s = suggestEntry('Swiggy', 'expense', [
      e('Swiggy', '2026-09-01', { account: 'SBI', payment_method: 'Credit card', amount: 400 }),
      e('SWIGGY*ORDER 99812345', '2026-09-20', { amount: 250 }),
      e('Swiggy', '2026-09-10', { amount: 250 }),
    ])
    expect(s).toEqual({ category: 'Dining', account: 'HDFC Bank', paymentMethod: 'UPI', debitCardId: null, amount: 250 })
  })
  it('leaves the amount out when it varies, and is null for unknown merchants', () => {
    const s = suggestEntry('Swiggy', 'expense', [e('Swiggy', '2026-09-20', { amount: 250 }), e('Swiggy', '2026-09-10', { amount: 300 })])
    expect(s?.amount).toBeNull()
    expect(suggestEntry('Zorblax', 'expense', [e('Swiggy', '2026-09-20')])).toBeNull()
  })
})
