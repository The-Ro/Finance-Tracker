import { describe, expect, it } from 'vitest'
import { evenShare, splitBalances } from './splits'

const me = 'me'
const splits = [
  { owner_user_id: 'me', with_user_id: 'priya', amount: 1600, settled_at: null },
  { owner_user_id: 'priya', with_user_id: 'me', amount: 740, settled_at: null },
  { owner_user_id: 'me', with_user_id: 'priya', amount: 1000, settled_at: null },
  { owner_user_id: 'me', with_user_id: 'priya', amount: 500, settled_at: '2026-09-01T00:00:00Z' },
  { owner_user_id: 'sam', with_user_id: 'me', amount: 99.99, settled_at: null },
  { owner_user_id: 'sam', with_user_id: 'alex', amount: 5, settled_at: null },
]

describe('splitBalances', () => {
  it('nets unsettled splits per person, ignoring settled and unrelated rows', () => {
    expect(splitBalances(splits, me)).toEqual([
      { userId: 'priya', owedToMe: 2600, iOwe: 740, net: 1860 },
      { userId: 'sam', owedToMe: 0, iOwe: 99.99, net: -99.99 },
    ])
  })
})

describe('evenShare', () => {
  it('rounds to cents', () => {
    expect(evenShare(3200)).toBe(1600)
    expect(evenShare(100, 3)).toBe(33.33)
  })
})
