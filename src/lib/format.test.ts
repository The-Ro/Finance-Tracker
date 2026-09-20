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
    expect(resolvePriorPeriod('this-month', now)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })
})
