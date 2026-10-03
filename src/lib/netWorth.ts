// Net worth worked out from what the app already knows, plus the user's own
// "other" totals (home, gold, a loan the app doesn't track). Pure, so it's
// unit-tested (netWorth.test.ts).

import type { AccountKind } from '@/types/database.types'

export interface NetWorthInput {
  /** Balance per account (useAccountBalances). */
  balances: Map<string, number>
  kinds: Map<string, AccountKind>
  /** Closed accounts are left out. */
  closed: Set<string>
  /** Money put into investments so far (investmentSummary().total) -- at cost, not today's value. */
  invested: number
  /** Lent & borrowed still open (summarizeIous). */
  lentOut: number
  borrowed: number
  /** Unsettled splits: what friends owe you, and what you owe them. */
  splitsOwedToYou: number
  splitsYouOwe: number
  /** Loan principal still to repay on active recurring loan / EMI items. */
  loansLeft: number
  /** The user's own totals from Settings -> Net worth. */
  otherAssets: number
  otherDebts: number
}

export interface NetWorthLine {
  key: 'accounts' | 'investments' | 'owedToYou' | 'other' | 'cards' | 'loans' | 'youOwe' | 'otherDebts'
  label: string
  amount: number
}

export interface NetWorth {
  total: number
  /** What you own, biggest first; zero lines left out. */
  own: NetWorthLine[]
  /** What you owe, biggest first, as positive amounts; zero lines left out. */
  owe: NetWorthLine[]
  ownTotal: number
  oweTotal: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function netWorth(input: NetWorthInput): NetWorth {
  let accounts = 0
  let cards = 0
  for (const [name, balance] of input.balances) {
    if (input.closed.has(name)) continue
    // A card in credit (paid more than owed) is money you have; an
    // overdrawn bank account is money you owe.
    if (balance >= 0) accounts += balance
    else if (input.kinds.get(name) === 'credit_card') cards += -balance
    else accounts += balance
  }

  const own: NetWorthLine[] = [
    { key: 'accounts', label: 'Banks, cash and wallets', amount: round2(accounts) },
    { key: 'investments', label: 'Put into investments', amount: round2(input.invested) },
    { key: 'owedToYou', label: 'Owed to you', amount: round2(input.lentOut + input.splitsOwedToYou) },
    { key: 'other', label: 'Other things you own', amount: round2(input.otherAssets) },
  ]
  const owe: NetWorthLine[] = [
    { key: 'cards', label: 'Credit card dues', amount: round2(cards) },
    { key: 'loans', label: 'Loans left to repay', amount: round2(input.loansLeft) },
    { key: 'youOwe', label: 'You owe people', amount: round2(input.borrowed + input.splitsYouOwe) },
    { key: 'otherDebts', label: 'Other debts', amount: round2(input.otherDebts) },
  ]

  const keep = (lines: NetWorthLine[]) => lines.filter((l) => l.amount !== 0).sort((a, b) => b.amount - a.amount)
  const ownTotal = round2(own.reduce((s, l) => s + l.amount, 0))
  const oweTotal = round2(owe.reduce((s, l) => s + l.amount, 0))
  return { total: round2(ownTotal - oweTotal), own: keep(own), owe: keep(owe), ownTotal, oweTotal }
}
