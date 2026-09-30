import { describe, expect, it } from 'vitest'
import {
  balanceAt,
  cardStatus,
  cashAndCardDebt,
  daysUntil,
  dueDateAfter,
  isBankKind,
  isFundedAccount,
  normalizeAccountKind,
  lastStatementDate,
  nextStatementDate,
  openingToOwed,
  owedToOpening,
  statementHistory,
  unbilled,
  type FlowTransaction,
} from './creditCards'

const card = 'HDFC Pixel Card'
const tx = [
  { type: 'expense', date: '2026-08-20', amount: 1000, account: card, to_account: null },
  { type: 'expense', date: '2026-09-05', amount: 300, account: card, to_account: null },
  { type: 'transfer', date: '2026-09-10', amount: 400, account: 'HDFC Bank', to_account: card },
  { type: 'expense', date: '2026-09-20', amount: 250, account: card, to_account: null },
  { type: 'income', date: '2026-09-01', amount: 5000, account: 'HDFC Bank', to_account: null },
]
const details = { kind: 'credit_card' as const, creditLimit: 5000, statementDay: 12, dueDay: 2 }

describe('statement and due dates', () => {
  it('finds the last statement date, clamping to short months', () => {
    expect(lastStatementDate(12, '2026-09-27')).toBe('2026-09-12')
    expect(lastStatementDate(12, '2026-09-05')).toBe('2026-08-12')
    expect(lastStatementDate(31, '2026-09-30')).toBe('2026-09-30')
    expect(lastStatementDate(31, '2026-03-15')).toBe('2026-02-28')
  })
  it('puts the due date after the statement, rolling into the next month', () => {
    expect(dueDateAfter('2026-09-12', 2)).toBe('2026-10-02')
    expect(dueDateAfter('2026-09-05', 25)).toBe('2026-09-25')
    expect(dueDateAfter('2026-12-12', 2)).toBe('2027-01-02')
  })
})

describe('cardStatus', () => {
  it('reports owed, available credit and utilization', () => {
    const s = cardStatus(card, 0, tx, details, '2026-09-27')
    expect(s.owed).toBe(1150)
    expect(s.available).toBe(3850)
    expect(s.utilization).toBeCloseTo(23)
    expect(balanceAt(card, 0, tx, '2026-09-12')).toBe(-900)
  })
  it('bills what was owed on the statement date minus payments since', () => {
    const s = cardStatus(card, 0, tx, details, '2026-09-27')
    // Statement 12 Sep: 1000 + 300 - 400 = 900 owed; the 20 Sep spend waits for the next bill.
    expect(s.bill).toEqual({ statementDate: '2026-09-12', dueDate: '2026-10-02', statementBalance: 900, paidSinceStatement: 0, due: 900 })
    const paid = [...tx, { type: 'transfer', date: '2026-09-25', amount: 900, account: 'HDFC Bank', to_account: card }]
    expect(cardStatus(card, 0, paid, details, '2026-09-27').bill?.due).toBe(0)
  })
  it('has no bill without statement and due days, and no limit figures without a limit', () => {
    const s = cardStatus(card, 0, tx, { ...details, creditLimit: null, statementDay: null }, '2026-09-27')
    expect(s.bill).toBeNull()
    expect(s.available).toBeNull()
    expect(s.utilization).toBeNull()
  })
  it('treats an overpaid card as credit, not debt', () => {
    const over = [{ type: 'transfer', date: '2026-09-01', amount: 500, account: 'HDFC Bank', to_account: card }]
    const s = cardStatus(card, 0, over, details, '2026-09-27')
    expect(s.owed).toBe(0)
    expect(s.credit).toBe(500)
  })
})

describe('cashAndCardDebt', () => {
  it('separates cash from card debt', () => {
    const balances = new Map([
      ['HDFC Bank', 10000],
      ['Cash', 500],
      [card, -1150],
      ['ICICI Card', 200],
    ])
    const kinds = new Map([
      ['HDFC Bank', 'savings' as const],
      ['Cash', 'cash' as const],
      [card, 'credit_card' as const],
      ['ICICI Card', 'credit_card' as const],
    ])
    expect(cashAndCardDebt(balances, kinds)).toEqual({ cash: 10700, cardDebt: 1150, net: 9550 })
  })
})

describe('account kinds', () => {
  it('treats savings and current as bank accounts, and only cards as unfunded', () => {
    expect(isBankKind('savings')).toBe(true)
    expect(isBankKind('current')).toBe(true)
    expect(isBankKind('credit_card')).toBe(false)
    expect(isBankKind('cash')).toBe(false)
    expect(isBankKind(undefined)).toBe(false)
    expect(isFundedAccount('current')).toBe(true)
    expect(isFundedAccount('credit_card')).toBe(false)
  })
  it('reads the old bank kind and anything unknown as savings', () => {
    expect(normalizeAccountKind('bank')).toBe('savings')
    expect(normalizeAccountKind(undefined)).toBe('savings')
    expect(normalizeAccountKind('credit_card')).toBe('credit_card')
    expect(normalizeAccountKind('current')).toBe('current')
  })
})

describe('owed <-> opening balance', () => {
  it('stores a positive amount owed as a negative opening balance, and back', () => {
    expect(owedToOpening(12862.4)).toBe(-12862.4)
    expect(openingToOwed(-12862.4)).toBe(12862.4)
    expect(owedToOpening(-200)).toBe(200) // card in credit
    expect(Object.is(owedToOpening(0), 0)).toBe(true)
    expect(Object.is(openingToOwed(0), 0)).toBe(true)
  })
})

describe('statementHistory', () => {
  it('lists statements newest first with paid / upcoming status', () => {
    const history = statementHistory(card, 0, tx, details, '2026-09-27', 3)
    expect(history.map((s) => s.statementDate)).toEqual(['2026-09-12', '2026-08-12', '2026-07-12'])
    // 12 Sep: owes 900, due 2 Oct, nothing paid yet -> upcoming.
    expect(history[0]).toEqual({ statementDate: '2026-09-12', dueDate: '2026-10-02', statementBalance: 900, paidByDue: 0, status: 'upcoming' })
    // 12 Aug: owed 0 (the 20 Aug spend came after) -> nothing to pay.
    expect(history[1]).toMatchObject({ statementBalance: 0, status: 'paid' })
  })

  it('marks past statements paid, partly paid or unpaid by what came in before the due date', () => {
    const spend = [{ type: 'expense', date: '2026-07-05', amount: 1000, account: card, to_account: null }]
    const late = [...spend, { type: 'transfer', date: '2026-08-10', amount: 1000, account: 'HDFC Bank', to_account: card }]
    const part = [...spend, { type: 'transfer', date: '2026-07-30', amount: 400, account: 'HDFC Bank', to_account: card }]
    const full = [...spend, { type: 'transfer', date: '2026-08-02', amount: 1000, account: 'HDFC Bank', to_account: card }]
    const july = (t: FlowTransaction[]) => statementHistory(card, 0, t, details, '2026-09-27', 3)[2]
    expect(july(spend)).toMatchObject({ statementDate: '2026-07-12', dueDate: '2026-08-02', statementBalance: 1000, paidByDue: 0, status: 'unpaid' })
    expect(july(late).status).toBe('unpaid') // paid after the 2 Aug due date
    expect(july(part)).toMatchObject({ paidByDue: 400, status: 'partly paid' })
    expect(july(full)).toMatchObject({ paidByDue: 1000, status: 'paid' })
  })

  it('clamps a 31st statement day to each month end', () => {
    const endOfMonth = { ...details, statementDay: 31, dueDay: 20 }
    const history = statementHistory(card, 0, [], endOfMonth, '2026-03-15', 4)
    expect(history.map((s) => s.statementDate)).toEqual(['2026-02-28', '2026-01-31', '2025-12-31', '2025-11-30'])
    expect(history.map((s) => s.dueDate)).toEqual(['2026-03-20', '2026-02-20', '2026-01-20', '2025-12-20'])
  })

  it('is empty without statement and due days', () => {
    expect(statementHistory(card, 0, tx, { ...details, dueDay: null }, '2026-09-27')).toEqual([])
  })
})

describe('unbilled', () => {
  it('lists card spends after the last statement, newest first', () => {
    const u = unbilled(card, tx, details, '2026-09-27')
    expect(u?.since).toBe('2026-09-12')
    expect(u?.transactions.map((t) => t.date)).toEqual(['2026-09-20'])
    expect(u?.total).toBe(250)
  })
  it('is null without a statement day', () => {
    expect(unbilled(card, tx, { ...details, statementDay: null }, '2026-09-27')).toBeNull()
  })
})

describe('daysUntil', () => {
  it('counts forward and backward', () => {
    expect(daysUntil('2026-10-02', '2026-09-27')).toBe(5)
    expect(daysUntil('2026-09-20', '2026-09-27')).toBe(-7)
    expect(daysUntil('2026-09-27', '2026-09-27')).toBe(0)
  })
})

describe('nextStatementDate', () => {
  it('is this month’s statement date if not passed yet, else next month’s (clamped)', () => {
    expect(nextStatementDate(12, '2026-10-01')).toBe('2026-10-12')
    expect(nextStatementDate(12, '2026-10-12')).toBe('2026-10-12')
    expect(nextStatementDate(12, '2026-10-13')).toBe('2026-11-12')
    expect(nextStatementDate(31, '2026-02-10')).toBe('2026-02-28')
  })
})
