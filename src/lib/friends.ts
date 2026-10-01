// Friends (the redesigned Sharing): everyone you have a sharing connection
// with, in either direction, with what each side sees and the money between
// you from splits. Built from viewer_access rows -- one row per direction:
// requester sees owner's entries once the owner approves.

export type TheySeeMine = 'on' | 'paused' | 'asking' | 'off'
export type ISeeTheirs = 'on' | 'paused' | 'waiting' | 'off'

interface AccessRow {
  id: string
  requester_user_id: string
  owner_user_id: string
  status: string
  created_at: string
}

export interface Friend {
  id: string
  /** Whether they can see your entries (they asked, you approved). */
  theySeeMine: TheySeeMine
  /** Whether you can see theirs. */
  iSeeTheirs: ISeeTheirs
  /** Their request to see yours (row you own). */
  incomingId: string | null
  /** Your request to see theirs. */
  outgoingId: string | null
  /** From splits: positive = they owe you, negative = you owe them. */
  net: number
  /** When you first connected (earliest row). */
  since: string
}

function seeState(status: string | undefined, pendingWord: 'asking' | 'waiting'): 'on' | 'paused' | 'asking' | 'waiting' | 'off' {
  if (status === 'approved') return 'on'
  if (status === 'paused') return 'paused'
  if (status === 'pending') return pendingWord
  return 'off'
}

/**
 * One entry per person connected to `me` either way. `owned` are rows where
 * I'm the owner (they see mine), `requested` where I'm the requester (I see
 * theirs). Split balances add the money side. People asking to see yours come
 * first, then everyone else in the order they connected.
 */
export function buildFriends(
  me: string,
  owned: readonly AccessRow[],
  requested: readonly AccessRow[],
  balances: readonly { userId: string; net: number }[] = []
): Friend[] {
  const map = new Map<string, Friend>()
  const get = (id: string, at: string): Friend => {
    const f = map.get(id) ?? { id, theySeeMine: 'off', iSeeTheirs: 'off', incomingId: null, outgoingId: null, net: 0, since: at }
    if (at < f.since) f.since = at
    map.set(id, f)
    return f
  }
  for (const r of owned) {
    if (r.owner_user_id !== me) continue
    const f = get(r.requester_user_id, r.created_at)
    f.theySeeMine = seeState(r.status, 'asking') as TheySeeMine
    f.incomingId = r.id
  }
  for (const r of requested) {
    if (r.requester_user_id !== me) continue
    const f = get(r.owner_user_id, r.created_at)
    f.iSeeTheirs = seeState(r.status, 'waiting') as ISeeTheirs
    f.outgoingId = r.id
  }
  for (const b of balances) {
    const f = map.get(b.userId)
    if (f) f.net = b.net
  }
  return [...map.values()].sort((a, b) => {
    const ask = Number(b.theySeeMine === 'asking') - Number(a.theySeeMine === 'asking')
    return ask || a.since.localeCompare(b.since)
  })
}

/** What each side sees, in plain words (for the friend card). */
export function sharingWords(f: Pick<Friend, 'theySeeMine' | 'iSeeTheirs'>): string {
  const mine = {
    on: 'Sees your entries',
    paused: 'Your entries are paused for them',
    asking: 'Wants to see your entries',
    off: 'Doesn’t see your entries',
  }[f.theySeeMine]
  const theirs = {
    on: 'you see theirs',
    paused: 'they paused theirs',
    waiting: 'you asked to see theirs',
    off: 'you don’t see theirs',
  }[f.iSeeTheirs]
  return `${mine} · ${theirs}`
}
