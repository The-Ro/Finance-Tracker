// Home's "Finish setting up" checklist: what a new user still has to do
// after the short welcome wizard. Done-ness is read from their data (nothing
// is stored per item), so doing a step anywhere in the app ticks it off.

export type SetupItemId = 'accounts' | 'bills' | 'budget' | 'goal' | 'import' | 'share'

export interface SetupFacts {
  /** A bank, card or wallet with a balance or an entry (beyond Cash). */
  hasAccounts: boolean
  hasBills: boolean
  hasBudget: boolean
  hasGoal: boolean
  hasImport: boolean
  /** A sharing connection in either direction (any status). */
  hasSharing: boolean
}

export interface SetupItem {
  id: SetupItemId
  done: boolean
}

const ORDER: SetupItemId[] = ['accounts', 'bills', 'budget', 'goal', 'import', 'share']

export function setupChecklist(facts: SetupFacts): { items: SetupItem[]; done: number; total: number; complete: boolean } {
  const doneBy: Record<SetupItemId, boolean> = {
    accounts: facts.hasAccounts,
    bills: facts.hasBills,
    budget: facts.hasBudget,
    goal: facts.hasGoal,
    import: facts.hasImport,
    share: facts.hasSharing,
  }
  const items = ORDER.map((id) => ({ id, done: doneBy[id] }))
  const done = items.filter((i) => i.done).length
  return { items, done, total: items.length, complete: done === items.length }
}
