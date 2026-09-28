import { describe, expect, it } from 'vitest'
import { savingsAccountFlows } from './savingsAccounts'

const sep = { start: '2026-09-01', end: '2026-09-30' }
const kinds = new Map([
  ['HDFC Savings', 'savings' as const],
  ['SBI Savings', 'savings' as const],
  ['Old Savings', 'savings' as const],
  ['Axis Current', 'current' as const],
  ['Pixel Card', 'credit_card' as const],
  ['Cash', 'cash' as const],
])
const balances = new Map([
  ['HDFC Savings', 2615.95],
  ['SBI Savings', 388.89],
  ['Old Savings', 50],
  ['Axis Current', 9000],
])
const tx = [
  { type: 'income', date: '2026-09-01', amount: 60000, account: 'HDFC Savings', to_account: null },
  { type: 'expense', date: '2026-09-03', amount: 500, account: 'HDFC Savings', to_account: null },
  { type: 'transfer', date: '2026-09-05', amount: 4000, account: 'HDFC Savings', to_account: 'SBI Savings' },
  { type: 'transfer', date: '2026-09-06', amount: 1000, account: 'HDFC Savings', to_account: 'Pixel Card' },
  { type: 'expense', date: '2026-09-07', amount: 300, account: 'Pixel Card', to_account: null },
  { type: 'income', date: '2026-08-31', amount: 999, account: 'SBI Savings', to_account: null },
  { type: 'expense', date: '2026-09-08', amount: 70, account: 'Axis Current', to_account: null },
]

describe('savingsAccountFlows', () => {
  it('lists open savings accounts only, with money in/out for the period (transfers included)', () => {
    const rows = savingsAccountFlows(tx, balances, kinds, new Set(['Old Savings']), sep)
    expect(rows).toEqual([
      { account: 'HDFC Savings', balance: 2615.95, moneyIn: 60000, moneyOut: 5500 },
      { account: 'SBI Savings', balance: 388.89, moneyIn: 4000, moneyOut: 0 },
    ])
  })

  it('skips untouched savings accounts (seeded banks), keeping used ones even when quiet this period', () => {
    const withSeeded = new Map([...kinds, ['Yes Bank', 'savings' as const], ['Kotak', 'savings' as const]])
    const oldOnly = [{ type: 'income', date: '2026-01-10', amount: 50, account: 'Kotak', to_account: null }]
    const rows = savingsAccountFlows([...tx, ...oldOnly], new Map([...balances, ['Kotak', 0]]), withSeeded, new Set(['Old Savings']), sep)
    expect(rows.map((r) => r.account)).toEqual(['HDFC Savings', 'SBI Savings', 'Kotak'])
    expect(rows[2]).toEqual({ account: 'Kotak', balance: 0, moneyIn: 0, moneyOut: 0 })
  })

  it('is empty when no account is marked as savings', () => {
    expect(savingsAccountFlows(tx, balances, new Map([['Cash', 'cash' as const]]), new Set(), sep)).toEqual([])
  })
})
