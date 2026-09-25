import { describe, expect, it } from 'vitest'
import { applyRules } from '@/lib/rules'

describe('applyRules', () => {
  it('uses the first enabled matching rule and de-duplicates tags', () => {
    expect(
      applyRules('NETFLIX.COM', 'Needs review', ['monthly'], [
        { whenText: 'netflix', thenText: 'category: Subscriptions, tag: Monthly, tag: entertainment', enabled: true },
      ])
    ).toEqual({ category: 'Subscriptions', tags: ['monthly', 'entertainment'] })
  })

  it('matches an imported merchant string with punctuation and a reference number', () => {
    expect(
      applyRules('UBER *TRIP 88123456', 'Needs review', [], [{ whenText: 'uber trip', thenText: 'Transportation', enabled: true }])
    ).toEqual({ category: 'Transportation', tags: [] })
  })

  it('leaves an unmatched transaction unchanged', () => {
    expect(applyRules('Corner Store', 'Needs review', [], [])).toEqual({ category: 'Needs review', tags: [] })
  })
})
