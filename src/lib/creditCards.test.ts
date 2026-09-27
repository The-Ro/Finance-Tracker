import { describe, expect, it } from 'vitest'
import { balanceAt, cardStatus, cashAndCardDebt, daysUntil, dueDateAfter, lastStatementDate } from './creditCards'

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
      ['HDFC Bank', 'bank' as const],
      ['Cash', 'cash' as const],
      [card, 'credit_card' as const],
      ['ICICI Card', 'credit_card' as const],
    ])
    expect(cashAndCardDebt(balances, kinds)).toEqual({ cash: 10700, cardDebt: 1150, net: 9550 })
  })
})

describe('daysUntil', () => {
  it('counts forward and backward', () => {
    expect(daysUntil('2026-10-02', '2026-09-27')).toBe(5)
    expect(daysUntil('2026-09-20', '2026-09-27')).toBe(-7)
    expect(daysUntil('2026-09-27', '2026-09-27')).toBe(0)
  })
})
