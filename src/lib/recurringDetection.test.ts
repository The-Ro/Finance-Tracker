import { describe, expect, it } from 'vitest'
import { detectRecurringCandidates, nextDateForCadence, nthDateForCadence } from '@/lib/recurringDetection'

describe('recurring detection', () => {
  it('preserves a valid day at the end of shorter months', () => {
    expect(nextDateForCadence('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextDateForCadence('2024-02-29', 'annual')).toBe('2025-02-28')
  })

  it('measures every occurrence from the anchor so a 31st does not drift to the 28th', () => {
    expect([1, 2, 3, 4].map((n) => nthDateForCadence('2026-01-31', 'monthly', n))).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
    expect(nthDateForCadence('2026-01-01', 'weekly', 3)).toBe('2026-01-22')
    expect(nthDateForCadence('2024-02-29', 'annual', 4)).toBe('2028-02-29')
  })

  const netflix = [
    { date: '2026-01-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
    { date: '2026-02-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
    { date: '2026-03-10', merchant: 'Netflix', category: 'Entertainment', amount: 15, tags: [], account: 'Card' },
  ]

  it('identifies a stable monthly subscription', () => {
    const candidates = detectRecurringCandidates(netflix, new Set(), new Set(), '2026-03-20')

    expect(candidates).toMatchObject([
      { merchant: 'Netflix', cadence: 'monthly', kind: 'subscription', nextDate: '2026-04-10', account: 'Card' },
    ])
  })

  it('does not suggest a pattern that has missed two of its cycles', () => {
    expect(detectRecurringCandidates(netflix, new Set(), new Set(), '2026-05-09')).toHaveLength(1)
    expect(detectRecurringCandidates(netflix, new Set(), new Set(), '2026-05-11')).toHaveLength(0)
    expect(detectRecurringCandidates(netflix, new Set(), new Set(), '2027-01-01')).toHaveLength(0)
  })
})
