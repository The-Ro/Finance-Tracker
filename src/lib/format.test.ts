import { describe, expect, it } from 'vitest'
import { toLocalISODate } from '@/lib/format'
import { resolvePeriod, resolvePriorPeriod } from '@/lib/period'

describe('local calendar-date helpers', () => {
  it('serializes the date using local calendar fields', () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('calculates current and preceding monthly periods at a year boundary', () => {
    const now = new Date(2026, 0, 15, 12)

    expect(resolvePeriod('this-month', now)).toEqual({ start: '2026-01-01', end: '2026-01-15' })
    expect(resolvePriorPeriod('this-month', now)).toEqual({ start: '2025-12-01', end: '2025-12-15' })
  })

  it('compares a partial period with the same stretch of the one before it', () => {
    const mar3 = new Date(2026, 2, 3, 12)
    expect(resolvePriorPeriod('this-month', mar3)).toEqual({ start: '2026-02-01', end: '2026-02-03' })
    expect(resolvePriorPeriod('this-year', mar3)).toEqual({ start: '2025-01-01', end: '2025-03-03' })
    expect(resolvePriorPeriod('last-3-months', mar3)).toEqual({ start: '2025-10-01', end: '2025-12-03' })
    expect(resolvePriorPeriod('last-6-months', mar3)).toEqual({ start: '2025-04-01', end: '2025-09-03' })

    // Clamped to the shorter month; a full month still compares with a full month.
    expect(resolvePriorPeriod('this-month', new Date(2026, 2, 31, 12))).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(resolvePriorPeriod('last-month', mar3)).toEqual({ start: '2026-01-01', end: '2026-01-31' })
  })
})
