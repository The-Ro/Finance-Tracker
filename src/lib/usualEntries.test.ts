import { describe, expect, it } from 'vitest'
import { usualEntries, type UsualSource } from './usualEntries'

const e = (merchant: string, date: string, amount: number, extra: Partial<UsualSource> = {}): UsualSource => ({
  merchant,
  category: 'Dining',
  type: 'expense',
  date,
  account: 'HDFC Bank',
  payment_method: 'UPI',
  debit_card_id: null,
  amount,
  ...extra,
})

// Thursday 1 Oct 2026, 9 AM local.
const now = new Date(2026, 9, 1, 9, 0)

describe('usualEntries', () => {
  it('needs at least two entries and ignores old ones', () => {
    const r = usualEntries([e('Tea stall', '2026-09-30', 20), e('Once only', '2026-09-29', 500), e('Tea stall', '2026-09-29', 20), e('Old place', '2026-05-01', 90), e('Old place', '2026-05-02', 90)], now)
    expect(r.map((u) => u.merchant)).toEqual(['Tea stall'])
    expect(r[0]).toMatchObject({ amount: 20, category: 'Dining', account: 'HDFC Bank', paymentMethod: 'UPI' })
  })
  it('groups different spellings of the same merchant', () => {
    const r = usualEntries([e('SWIGGY #1234', '2026-09-30', 300), e('Swiggy', '2026-09-20', 450)], now)
    expect(r).toHaveLength(1)
    expect(r[0].amount).toBeNull()
    expect(r[0].merchant).toBe('SWIGGY #1234')
  })
  it('prefers the same weekday and time of day', () => {
    const r = usualEntries(
      [
        e('Coffee', '2026-09-24', 120, { created_at: new Date(2026, 8, 24, 9, 5).toISOString() }), // a Thursday morning
        e('Coffee', '2026-09-17', 120, { created_at: new Date(2026, 8, 17, 8, 50).toISOString() }),
        e('Dinner', '2026-09-26', 600, { created_at: new Date(2026, 8, 26, 21, 0).toISOString() }),
        e('Dinner', '2026-09-27', 600, { created_at: new Date(2026, 8, 27, 21, 0).toISOString() }),
      ],
      now
    )
    expect(r.map((u) => u.merchant)).toEqual(['Coffee', 'Dinner'])
  })
  it('keeps income and spending apart and uses the most used category', () => {
    const r = usualEntries(
      [
        e('Acme', '2026-09-30', 50000, { type: 'income', category: 'Salary' }),
        e('Acme', '2026-08-31', 50000, { type: 'income', category: 'Salary' }),
        e('Market', '2026-09-30', 200, { category: 'Groceries' }),
        e('Market', '2026-09-25', 300, { category: 'Groceries' }),
        e('Market', '2026-09-20', 250, { category: 'Snacks' }),
      ],
      now
    )
    expect(r.find((u) => u.type === 'income')).toMatchObject({ merchant: 'Acme', amount: 50000, category: 'Salary' })
    expect(r.find((u) => u.merchant === 'Market')?.category).toBe('Groceries')
  })
})
