import { describe, expect, it } from 'vitest'
import { buildFingerprint } from '@/lib/fingerprint'

describe('buildFingerprint', () => {
  it('normalizes text while preserving the financial fields that identify a transaction', () => {
    expect(buildFingerprint({ date: '2026-09-13', merchant: '  Coffee Shop ', amount: 12.5, account: ' Cash ' }))
      .toBe('2026-09-13|coffee shop|12.50|cash')
  })
})
