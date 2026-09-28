import { DEFAULT_ACCOUNT_KIND, isBankKind, type AccountKind } from '@/lib/creditCards'

export interface AccountGroups {
  /** Savings and current accounts. */
  bank: string[]
  credit: string[]
  /** Cash and wallets. */
  cashWallet: string[]
}

/** Splits account names by kind, keeping the input order within each group. A name without a kind counts as a bank account. */
export function groupAccounts(names: readonly string[], kinds: ReadonlyMap<string, AccountKind>): AccountGroups {
  const groups: AccountGroups = { bank: [], credit: [], cashWallet: [] }
  for (const name of names) {
    const kind = kinds.get(name) ?? DEFAULT_ACCOUNT_KIND
    if (kind === 'credit_card') groups.credit.push(name)
    else if (isBankKind(kind)) groups.bank.push(name)
    else groups.cashWallet.push(name)
  }
  return groups
}

export interface AccountUsageInput {
  accounts: readonly string[]
  transactions: readonly { account: string; to_account: string | null }[]
  openingBalances: ReadonlyMap<string, number>
  kinds: ReadonlyMap<string, AccountKind>
  debitCards: readonly { account: string }[]
  recurringAccounts: Iterable<string | null>
  /** accounts.created_by per name. Signup seeds ~44 banks with created_by null; accounts a user adds carry their id. */
  createdBy: ReadonlyMap<string, string | null>
  userId: string | null
  /** Closed accounts (accounts.closed_at set) -- never "in use", whatever their history. */
  closed?: ReadonlySet<string>
}

/**
 * The accounts this user actually uses, so pickers can hide the dozens of
 * seeded-but-untouched banks without deleting anything: any account with a
 * transaction (either side), a non-zero opening balance, a debit card, a
 * recurring item, a kind other than the default, or that the user added --
 * except closed accounts, which keep their history but leave pickers.
 */
export function accountsInUse(input: AccountUsageInput): Set<string> {
  const used = new Set<string>()
  for (const t of input.transactions) {
    used.add(t.account)
    if (t.to_account) used.add(t.to_account)
  }
  for (const [name, opening] of input.openingBalances) if (opening !== 0) used.add(name)
  for (const card of input.debitCards) used.add(card.account)
  for (const name of input.recurringAccounts) if (name) used.add(name)
  for (const [name, kind] of input.kinds) if (kind !== DEFAULT_ACCOUNT_KIND) used.add(name)
  if (input.userId) {
    for (const [name, by] of input.createdBy) if (by === input.userId) used.add(name)
  }
  const known = new Set(input.accounts)
  return new Set([...used].filter((name) => known.has(name) && !input.closed?.has(name)))
}
