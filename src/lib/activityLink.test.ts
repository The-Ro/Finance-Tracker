import { describe, expect, it } from 'vitest'
import { activityLink, rangeFromParams } from './activityLink'

describe('activityLink', () => {
  it('builds a filtered Activity link and reads it back', () => {
    const link = activityLink('Food & drinks', { start: '2026-09-30', end: '2026-10-01' })
    expect(link).toBe('/transactions?category=Food+%26+drinks&since=2026-09-30&until=2026-10-01')
    const params = new URLSearchParams(link.split('?')[1])
    expect(params.get('category')).toBe('Food & drinks')
    expect(rangeFromParams(params)).toEqual({ start: '2026-09-30', end: '2026-10-01' })
  })
  it('ignores bad or backwards dates', () => {
    expect(rangeFromParams(new URLSearchParams('since=2026-10-05&until=2026-10-01'))).toBeNull()
    expect(rangeFromParams(new URLSearchParams('until=yesterday'))).toBeNull()
    expect(rangeFromParams(new URLSearchParams('category=Bike'))).toBeNull()
  })
})
