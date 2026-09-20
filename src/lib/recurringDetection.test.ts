import { describe, expect, it } from 'vitest'
import { detectRecurringCandidates, nextDateForCadence } from '@/lib/recurringDetection'

describe('recurring detection', () => {
  it('preserves a valid day at the end of shorter months', () => {
    expect(nextDateForCadence('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextDateForCadence('2024-02-29', 'annual')).toBe('2025-02-28')
  })

  it('identifies a stable monthly subscription', () => {
    const candidates = detectRecurringCandidates(
      [
        { date: '2026-01-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
        { date: '2026-02-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
        { date: '2026-03-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
      ],
      new Set(),
      new Set()
    )

    expect(candidates).toMatchObject([
      { merchant: 'Netflix', cadence: 'monthly', kind: 'subscription', nextDate: '2026-04-10', account: 'Card' },
    ])
  })
})
