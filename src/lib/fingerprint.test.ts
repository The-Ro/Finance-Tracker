import { describe, expect, it } from 'vitest'
import { buildFingerprint } from '@/lib/fingerprint'

describe('buildFingerprint', () => {
  it('normalizes text while preserving the financial fields that identify a transaction', () => {
    expect(buildFingerprint({ date: '2026-09-13', merchant: '  Coffee Shop ', amount: 12.5, account: ' Cash ' }))
      .toBe('2026-09-13|coffee shop|12.50|cash')
  })

  it('leaves expense fingerprints unchanged and suffixes income and transfers', () => {
    const base = { date: '2026-03-01', merchant: 'Amazon', amount: 49.99, account: 'Visa' }
    expect(buildFingerprint({ ...base, type: 'expense' })).toBe('2026-03-01|amazon|49.99|visa')
    expect(buildFingerprint({ ...base, type: 'income' })).toBe('2026-03-01|amazon|49.99|visa|income')
    expect(buildFingerprint({ ...base, type: 'transfer', toAccount: ' Savings ' })).toBe(
      '2026-03-01|amazon|49.99|visa|transfer|savings'
    )
  })

  it('does not collide a same-day refund with the purchase', () => {
    const base = { date: '2026-03-01', merchant: 'Amazon', amount: 49.99, account: 'Visa' }
    expect(buildFingerprint({ ...base, type: 'income' })).not.toBe(buildFingerprint({ ...base, type: 'expense' }))
  })
})
