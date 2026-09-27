import { addDaysISO } from '@/lib/billCalendar'

export type AccountKind = 'bank' | 'credit_card' | 'cash' | 'wallet'

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  bank: 'Bank',
  credit_card: 'Credit card',
  cash: 'Cash',
  wallet: 'Wallet',
}

export interface AccountDetails {
  kind: AccountKind
  creditLimit: number | null
  statementDay: number | null
  dueDay: number | null
  /** Closed accounts keep their history but drop out of pickers, balances and bills. */
  closed?: boolean
}

interface FlowTransaction {
  type: string
  date: string
  amount: number
  account: string
  to_account: string | null
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** `day` of the given month as an ISO date, clamped to the month's last day (31 -> 30 Sep). */
function dayOfMonth(year: number, monthIndex: number, day: number): string {
  const y = year + Math.floor(monthIndex / 12)
  const m = ((monthIndex % 12) + 12) % 12
  const d = Math.min(day, daysInMonth(y, m))
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The most recent statement date on or before `today`. */
export function lastStatementDate(statementDay: number, today: string): string {
  const [y, m] = today.split('-').map(Number)
  const thisMonth = dayOfMonth(y, m - 1, statementDay)
  return thisMonth <= today ? thisMonth : dayOfMonth(y, m - 2, statementDay)
}

/** The first `dueDay` strictly after the statement date (same month if it's later, else next month). */
export function dueDateAfter(statementDate: string, dueDay: number): string {
  const [y, m] = statementDate.split('-').map(Number)
  const sameMonth = dayOfMonth(y, m - 1, dueDay)
  return sameMonth > statementDate ? sameMonth : dayOfMonth(y, m, dueDay)
}

/** How a transaction moves one account's balance (bank-style sign: money in positive). */
function effectOn(account: string, t: FlowTransaction): number {
  if (t.type === 'income') return t.account === account ? t.amount : 0
  if (t.type === 'expense') return t.account === account ? -t.amount : 0
  if (t.type === 'transfer') {
    if (t.account === account) return -t.amount
    if (t.to_account === account) return t.amount
  }
  return 0
}

/** Balance of one account at the end of `date` (bank-style sign; a card that's owed money is negative). */
export function balanceAt(account: string, opening: number, transactions: FlowTransaction[], date: string): number {
  let balance = opening
  for (const t of transactions) if (t.date <= date) balance += effectOn(account, t)
  return Math.round(balance * 100) / 100
}

export interface CardStatus {
  /** What's owed right now (never negative; an overpaid card owes 0). */
  owed: number
  /** Overpayment sitting on the card, if any. */
  credit: number
  /** Limit minus owed; null without a limit. */
  available: number | null
  /** 0-100 share of the limit in use; null without a limit. */
  utilization: number | null
  /** Set only when both statement and due days are known. */
  bill: {
    statementDate: string
    dueDate: string
    /** Owed as of the statement date. */
    statementBalance: number
    /** Paid into the card since the statement date. */
    paidSinceStatement: number
    /** Still to pay for that statement (never negative). */
    due: number
  } | null
}

/**
 * A credit card's position. Card balances use the same sign as every other
 * account (spends make it negative), so "owed" is the negative part. The bill
 * is what was owed on the last statement date minus what's been paid into the
 * card since -- like a real statement, later spends go on the next bill.
 */
export function cardStatus(
  account: string,
  opening: number,
  transactions: FlowTransaction[],
  details: AccountDetails,
  today: string
): CardStatus {
  const balance = balanceAt(account, opening, transactions, today)
  const owed = Math.max(0, -balance)
  const credit = Math.max(0, balance)
  const limit = details.creditLimit
  let bill: CardStatus['bill'] = null
  if (details.statementDay && details.dueDay) {
    const statementDate = lastStatementDate(details.statementDay, today)
    const statementBalance = Math.max(0, -balanceAt(account, opening, transactions, statementDate))
    let paid = 0
    for (const t of transactions) {
      if (t.date > statementDate && t.date <= today && t.type !== 'expense' && effectOn(account, t) > 0) paid += t.amount
    }
    paid = Math.round(paid * 100) / 100
    bill = {
      statementDate,
      dueDate: dueDateAfter(statementDate, details.dueDay),
      statementBalance,
      paidSinceStatement: paid,
      due: Math.max(0, Math.round((statementBalance - paid) * 100) / 100),
    }
  }
  return {
    owed,
    credit,
    available: limit != null ? Math.round((limit - owed) * 100) / 100 : null,
    utilization: limit ? Math.min(100, (owed / limit) * 100) : null,
    bill,
  }
}

/**
 * Money that's actually yours vs. what you owe on cards, from per-account
 * balances. Cash/bank/wallet accounts add up to `cash` (can be negative if
 * overdrawn); credit cards contribute what's owed to `cardDebt` (an overpaid
 * card's credit counts as cash). `net` = cash - cardDebt.
 */
export function cashAndCardDebt(
  balances: Map<string, number>,
  kinds: Map<string, AccountKind>
): { cash: number; cardDebt: number; net: number } {
  let cash = 0
  let cardDebt = 0
  for (const [name, balance] of balances) {
    if (kinds.get(name) === 'credit_card') {
      if (balance < 0) cardDebt += -balance
      else cash += balance
    } else cash += balance
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return { cash: r(cash), cardDebt: r(cardDebt), net: r(cash - cardDebt) }
}

/** True when money leaving this account can't exceed what's there (not a credit card). */
export function isFundedAccount(kind: AccountKind | undefined): boolean {
  return kind !== 'credit_card'
}

/** Days until an ISO date from `today` (negative when past). */
export function daysUntil(date: string, today: string): number {
  let n = 0
  if (date >= today) {
    while (addDaysISO(today, n) < date) n++
    return n
  }
  while (addDaysISO(date, n) < today) n++
  return -n
}
