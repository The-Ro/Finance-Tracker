interface SplitLike {
  owner_user_id: string
  with_user_id: string
  amount: number
  settled_at: string | null
}

export interface PersonBalance {
  userId: string
  /** Unsettled amount this person owes me (I paid). */
  owedToMe: number
  /** Unsettled amount I owe this person (they paid). */
  iOwe: number
  /** owedToMe - iOwe: positive = they owe me overall. */
  net: number
}

/** Per-person unsettled balances from my point of view, largest first. */
export function splitBalances(splits: SplitLike[], me: string): PersonBalance[] {
  const map = new Map<string, PersonBalance>()
  const get = (userId: string) => {
    const b = map.get(userId) ?? { userId, owedToMe: 0, iOwe: 0, net: 0 }
    map.set(userId, b)
    return b
  }
  for (const s of splits) {
    if (s.settled_at) continue
    if (s.owner_user_id === me) get(s.with_user_id).owedToMe += s.amount
    else if (s.with_user_id === me) get(s.owner_user_id).iOwe += s.amount
  }
  for (const b of map.values()) {
    b.owedToMe = Math.round(b.owedToMe * 100) / 100
    b.iOwe = Math.round(b.iOwe * 100) / 100
    b.net = Math.round((b.owedToMe - b.iOwe) * 100) / 100
  }
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
}

/** An even share of `total` for `people` people (including the payer), rounded to cents. */
export function evenShare(total: number, people = 2): number {
  return Math.round((total / people) * 100) / 100
}

interface IdentifiedSplit extends SplitLike {
  id: string
}

export interface PersonSplitSummary {
  /** Unsettled split expenses between me and this person, in either direction. */
  count: number
  /** Unsettled splits I paid for with this person -- the only ones I can settle (RLS lets only the payer update). */
  settleableIds: string[]
}

/** What "Settle all" can act on for one person, plus the "From N shared expenses" count. */
export function personSplitSummary(splits: IdentifiedSplit[], me: string, other: string): PersonSplitSummary {
  let count = 0
  const settleableIds: string[] = []
  for (const s of splits) {
    if (s.settled_at) continue
    const iPaid = s.owner_user_id === me && s.with_user_id === other
    const theyPaid = s.owner_user_id === other && s.with_user_id === me
    if (!iPaid && !theyPaid) continue
    count++
    if (iPaid) settleableIds.push(s.id)
  }
  return { count, settleableIds }
}
