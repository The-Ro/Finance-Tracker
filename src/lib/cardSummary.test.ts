import { describe, expect, it } from 'vitest'
import { cardLimitTotals, utilizationTone } from './cardSummary'

describe('utilizationTone', () => {
  it('is green below 30%, amber from 30% to 70%, red above 70%', () => {
    expect(utilizationTone(0)).toBe('positive')
    expect(utilizationTone(29.9)).toBe('positive')
    expect(utilizationTone(30)).toBe('caution')
    expect(utilizationTone(70)).toBe('caution')
    expect(utilizationTone(70.1)).toBe('danger')
    expect(utilizationTone(100)).toBe('danger')
  })
})

describe('cardLimitTotals', () => {
  it('sums limits and what is owed on cards that have one', () => {
    const t = cardLimitTotals([
      { owed: 10402, limit: 50000 },
      { owed: 2715, limit: 30000 },
      { owed: 500, limit: null }, // no limit: left out of the share
    ])
    expect(t.limit).toBe(80000)
    expect(t.owedOnLimited).toBe(13117)
    expect(t.percent).toBeCloseTo(16.396, 2)
  })

  it('has no percent when no card has a limit, and caps at 100', () => {
    expect(cardLimitTotals([{ owed: 5, limit: null }]).percent).toBeNull()
    expect(cardLimitTotals([]).percent).toBeNull()
    expect(cardLimitTotals([{ owed: 200, limit: 100 }]).percent).toBe(100)
  })
})
