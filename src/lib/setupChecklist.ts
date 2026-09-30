// Home's "Finish setting up" checklist: what a new user still has to do
// after the short welcome wizard. Done-ness is read from their data (nothing
// is stored per item), so doing a step anywhere in the app ticks it off.
//
// Each step records the checklist version it arrived in. A release that adds
// a step bumps SETUP_CHECKLIST_VERSION: someone who hid the card at an older
// version sees it again -- with the new step marked "New" -- until that step
// is done or they hide it again (user_settings.setup_checklist_version).

export type SetupItemId = 'accounts' | 'salary' | 'bills' | 'budget' | 'goal' | 'import' | 'share'

/** Bump when a step is added (and give the step that number in SINCE). */
export const SETUP_CHECKLIST_VERSION = 2

const SINCE: Record<SetupItemId, number> = {
  accounts: 1,
  salary: 2,
  bills: 1,
  budget: 1,
  goal: 1,
  import: 1,
  share: 1,
}

export interface SetupFacts {
  /** A bank, card or wallet with a balance or an entry (beyond Cash). */
  hasAccounts: boolean
  /** Salary day set up (Settings -> Salary). */
  hasSalary: boolean
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
  /** Added since the user last hid the card. */
  isNew: boolean
}

export interface SetupState {
  items: SetupItem[]
  done: number
  total: number
  complete: boolean
  /** Whether Home shows the card. */
  visible: boolean
}

const ORDER: SetupItemId[] = ['accounts', 'salary', 'bills', 'budget', 'goal', 'import', 'share']

export function setupChecklist(facts: SetupFacts, hidden: { dismissed: boolean; version: number } = { dismissed: false, version: 1 }): SetupState {
  const doneBy: Record<SetupItemId, boolean> = {
    accounts: facts.hasAccounts,
    salary: facts.hasSalary,
    bills: facts.hasBills,
    budget: facts.hasBudget,
    goal: facts.hasGoal,
    import: facts.hasImport,
    share: facts.hasSharing,
  }
  const items = ORDER.map((id) => ({ id, done: doneBy[id], isNew: hidden.dismissed && SINCE[id] > hidden.version }))
  const done = items.filter((i) => i.done).length
  const complete = done === items.length
  const newStepOpen = items.some((i) => i.isNew && !i.done)
  return { items, done, total: items.length, complete, visible: !complete && (!hidden.dismissed || newStepOpen) }
}
