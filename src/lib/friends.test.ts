import { describe, expect, it } from 'vitest'
import { buildFriends, sharingWords } from './friends'

const row = (id: string, requester: string, owner: string, status: string, created_at = '2026-09-01T00:00:00Z') => ({
  id,
  requester_user_id: requester,
  owner_user_id: owner,
  status,
  created_at,
})

describe('buildFriends', () => {
  it('merges both directions into one friend with what each side sees', () => {
    const friends = buildFriends('me', [row('a', 'ann', 'me', 'approved')], [row('b', 'me', 'ann', 'pending')], [{ userId: 'ann', net: 250 }])
    expect(friends).toEqual([
      { id: 'ann', theySeeMine: 'on', iSeeTheirs: 'waiting', incomingId: 'a', outgoingId: 'b', net: 250, since: '2026-09-01T00:00:00Z' },
    ])
  })
  it('puts people asking to see yours first', () => {
    const friends = buildFriends(
      'me',
      [row('a', 'ann', 'me', 'approved', '2026-08-01T00:00:00Z'), row('c', 'cat', 'me', 'pending', '2026-09-10T00:00:00Z')],
      [row('d', 'me', 'dev', 'paused', '2026-07-01T00:00:00Z')]
    )
    expect(friends.map((f) => [f.id, f.theySeeMine, f.iSeeTheirs])).toEqual([
      ['cat', 'asking', 'off'],
      ['dev', 'off', 'paused'],
      ['ann', 'on', 'off'],
    ])
  })
  it('ignores rows that are not mine and balances of strangers', () => {
    expect(buildFriends('me', [row('x', 'a', 'b', 'approved')], [], [{ userId: 'zed', net: 10 }])).toEqual([])
  })
})

describe('sharingWords', () => {
  it('says both directions plainly', () => {
    expect(sharingWords({ theySeeMine: 'on', iSeeTheirs: 'on' })).toBe('Sees your entries · you see theirs')
    expect(sharingWords({ theySeeMine: 'asking', iSeeTheirs: 'off' })).toBe('Wants to see your entries · you don’t see theirs')
  })
})
