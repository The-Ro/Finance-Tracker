import { describe, expect, it } from 'vitest'
import { calculateAccountBalances } from '@/lib/accountBalances'

describe('calculateAccountBalances', () => {
  it('accounts for income, expenses, and both sides of a transfer', () => {
    const balances = calculateAccountBalances([
      { type: 'income', account: 'Salary', to_account: null, amount: 2_000 },
      { type: 'expense', account: 'Salary', to_account: null, amount: 300 },
      { type: 'transfer', account: 'Salary', to_account: 'Savings', amount: 500 },
    ])

    expect(Object.fromEntries(balances)).toEqual({ Salary: 1_200, Savings: 500 })
  })
})
