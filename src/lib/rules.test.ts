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

  it('leaves an unmatched transaction unchanged', () => {
    expect(applyRules('Corner Store', 'Needs review', [], [])).toEqual({ category: 'Needs review', tags: [] })
  })
})
