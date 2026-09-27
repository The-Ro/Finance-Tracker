import { describe, expect, it } from 'vitest'
import { evenShare, personSplitSummary, splitBalances } from './splits'

const me = 'me'
const splits = [
  { id: 'a', owner_user_id: 'me', with_user_id: 'priya', amount: 1600, settled_at: null },
  { id: 'b', owner_user_id: 'priya', with_user_id: 'me', amount: 740, settled_at: null },
  { id: 'c', owner_user_id: 'me', with_user_id: 'priya', amount: 1000, settled_at: null },
  { id: 'd', owner_user_id: 'me', with_user_id: 'priya', amount: 500, settled_at: '2026-09-01T00:00:00Z' },
  { id: 'e', owner_user_id: 'sam', with_user_id: 'me', amount: 99.99, settled_at: null },
  { id: 'f', owner_user_id: 'sam', with_user_id: 'alex', amount: 5, settled_at: null },
]

describe('splitBalances', () => {
  it('nets unsettled splits per person, ignoring settled and unrelated rows', () => {
    expect(splitBalances(splits, me)).toEqual([
      { userId: 'priya', owedToMe: 2600, iOwe: 740, net: 1860 },
      { userId: 'sam', owedToMe: 0, iOwe: 99.99, net: -99.99 },
    ])
  })
})

describe('personSplitSummary', () => {
  it('counts unsettled splits both ways but only lets me settle the ones I paid', () => {
    expect(personSplitSummary(splits, me, 'priya')).toEqual({ count: 3, settleableIds: ['a', 'c'] })
  })

  it('has nothing to settle when only the other person paid', () => {
    expect(personSplitSummary(splits, me, 'sam')).toEqual({ count: 1, settleableIds: [] })
  })

  it('ignores splits between other people', () => {
    expect(personSplitSummary(splits, me, 'alex')).toEqual({ count: 0, settleableIds: [] })
  })
})

describe('evenShare', () => {
  it('rounds to cents', () => {
    expect(evenShare(3200)).toBe(1600)
    expect(evenShare(100, 3)).toBe(33.33)
  })
})
