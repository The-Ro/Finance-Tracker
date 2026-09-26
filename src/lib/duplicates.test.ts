import { describe, expect, it } from 'vitest'
import { findDuplicateGroups } from '@/lib/duplicates'
import type { Transaction } from '@/hooks/useTransactions'

let n = 0
function txn(overrides: Partial<Transaction> = {}): Transaction {
  n += 1
  return {
    id: `t${n}`,
    owner_user_id: 'owner-1',
    date: '2026-09-10',
    merchant: 'Blue Bottle Coffee',
    category: 'Dining',
    amount: 12.5,
    type: 'expense',
    account: 'Cash',
    to_account: null,
    remarks: null,
    payment_method: null,
    tags: [],
    receipt: false,
    receipt_document_id: null,
    source: 'manual',
    fingerprint: `fp-${n}`,
    created_at: `2026-09-10T00:00:0${n % 10}Z`,
    original_currency: null,
    original_amount: null,
    fx_rate: null,
    ...overrides,
  }
}

describe('findDuplicateGroups', () => {
  it('groups a manual entry with a CSV import of the same purchase (different merchant text and posting date)', () => {
    const manual = txn({ merchant: 'Blue Bottle Coffee', date: '2026-09-10' })
    const csv = txn({ merchant: 'BLUE BOTTLE COFFEE #4471', date: '2026-09-12', source: 'csv' })
    const groups = findDuplicateGroups([manual, csv])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((t) => t.id).sort()).toEqual([manual.id, csv.id].sort())
  })

  it('does not group transactions that differ in amount, account, type, or are too far apart', () => {
    const base = txn()
    expect(findDuplicateGroups([base, txn({ amount: 12.51 })])).toEqual([])
    expect(findDuplicateGroups([base, txn({ account: 'HDFC Bank' })])).toEqual([])
    expect(findDuplicateGroups([base, txn({ type: 'income' })])).toEqual([])
    expect(findDuplicateGroups([base, txn({ date: '2026-09-20' })])).toEqual([])
  })

  it('does not group clearly different merchants that happen to share an amount', () => {
    expect(findDuplicateGroups([txn({ merchant: 'Blue Bottle Coffee' }), txn({ merchant: 'Metro Pharmacy' })])).toEqual([])
  })

  it('links a chain (A~B, B~C) into one group of three, newest first', () => {
    const a = txn({ date: '2026-09-01' })
    const b = txn({ date: '2026-09-03' })
    const c = txn({ date: '2026-09-05' })
    const groups = findDuplicateGroups([a, b, c])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((t) => t.date)).toEqual(['2026-09-05', '2026-09-03', '2026-09-01'])
  })

  it('treats one merchant name containing the other as similar, but not for very short names', () => {
    expect(findDuplicateGroups([txn({ merchant: 'Amazon' }), txn({ merchant: 'Amazon Prime' })])).toHaveLength(1)
    expect(findDuplicateGroups([txn({ merchant: 'Ola' }), txn({ merchant: 'Ola Cabs' })])).toEqual([])
  })

  it('keeps transfers to different destination accounts apart', () => {
    const a = txn({ type: 'transfer', category: null, to_account: 'Savings' })
    const b = txn({ type: 'transfer', category: null, to_account: 'Wallet' })
    expect(findDuplicateGroups([a, b])).toEqual([])
  })

  it('returns nothing for empty or all-unique input', () => {
    expect(findDuplicateGroups([])).toEqual([])
    expect(findDuplicateGroups([txn({ amount: 1 }), txn({ amount: 2 })])).toEqual([])
  })
})
