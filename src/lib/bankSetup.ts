// Onboarding's "Which banks do you use?" step, as a plan the step then carries
// out. Signup seeds ~44 Indian banks; the user picks the ones they use (with
// savings/current and what's in them today) and the untouched rest are
// removed, so pickers and Settings start out holding only their banks.

import { isBankKind, type AccountKind } from '@/lib/creditCards'

export interface BankChoice {
  kind: 'savings' | 'current'
  /** What's in it today; null = leave the balance as it is. */
  balance: number | null
}

export interface BankPlanInput {
  /** Every account name the user has. */
  accounts: readonly string[]
  kinds: ReadonlyMap<string, AccountKind>
  /** Accounts in use (accountsInUse) -- never removed, whatever the user picks. */
  inUse: ReadonlySet<string>
  /** accounts.created_by per name: null for a bank seeded at signup. */
  createdBy: ReadonlyMap<string, string | null>
  /** The banks picked, by name (a name not in `accounts` is a bank to add). */
  chosen: ReadonlyMap<string, BankChoice>
}

export interface BankPlan {
  /** New banks the user typed in: create as their own. */
  create: { name: string; kind: 'savings' | 'current'; opening: number }[]
  /** Picked seeded banks nobody used: re-create as the user's own (so they count as in use). */
  adopt: { name: string; kind: 'savings' | 'current'; opening: number }[]
  /** Picked banks already in use: change the kind and/or today's balance. */
  update: { name: string; kind?: 'savings' | 'current'; balance?: number }[]
  /** Seeded banks nobody used and the user didn't pick: delete. */
  remove: string[]
}

/** A bank from the signup seed list that nothing uses yet. */
export function isUntouchedSeededBank(name: string, input: Pick<BankPlanInput, 'kinds' | 'inUse' | 'createdBy'>): boolean {
  return isBankKind(input.kinds.get(name)) && input.createdBy.get(name) == null && !input.inUse.has(name)
}

export function planBankSetup(input: BankPlanInput): BankPlan {
  const plan: BankPlan = { create: [], adopt: [], update: [], remove: [] }
  const known = new Set(input.accounts)
  for (const [name, choice] of input.chosen) {
    if (!known.has(name)) {
      plan.create.push({ name, kind: choice.kind, opening: choice.balance ?? 0 })
    } else if (isUntouchedSeededBank(name, input)) {
      plan.adopt.push({ name, kind: choice.kind, opening: choice.balance ?? 0 })
    } else {
      const change: BankPlan['update'][number] = { name }
      if (input.kinds.get(name) !== choice.kind) change.kind = choice.kind
      if (choice.balance !== null) change.balance = choice.balance
      if (change.kind !== undefined || change.balance !== undefined) plan.update.push(change)
    }
  }
  for (const name of input.accounts) {
    if (!input.chosen.has(name) && isUntouchedSeededBank(name, input)) plan.remove.push(name)
  }
  return plan
}
