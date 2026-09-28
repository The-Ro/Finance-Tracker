import { describe, expect, it } from 'vitest'
import { accountsInUse, groupAccounts } from './accountGroups'
import type { AccountKind } from './creditCards'

describe('groupAccounts', () => {
  it('splits bank accounts, credit cards and cash/wallets, keeping input order', () => {
    const kinds = new Map<string, AccountKind>([
      ['Cash', 'cash'],
      ['HDFC Credit Card', 'credit_card'],
      ['ICICI Current', 'current'],
      ['Paytm', 'wallet'],
    ])
    expect(groupAccounts(['Cash', 'HDFC Bank', 'HDFC Credit Card', 'ICICI Current', 'Paytm'], kinds)).toEqual({
      bank: ['HDFC Bank', 'ICICI Current'],
      credit: ['HDFC Credit Card'],
      cashWallet: ['Cash', 'Paytm'],
    })
  })
})

describe('accountsInUse', () => {
  const base = {
    accounts: ['Axis Bank', 'Cash', 'HDFC Bank', 'ICICI Bank', 'Kotak Mahindra Bank', 'My Chit Fund', 'SBI', 'Yes Bank', 'HDFC Credit Card'],
    transactions: [{ account: 'HDFC Bank', to_account: 'HDFC Credit Card' }],
    openingBalances: new Map([
      ['ICICI Bank', 5000],
      ['Axis Bank', 0],
    ]),
    kinds: new Map<string, AccountKind>([
      ['Cash', 'cash'],
      ['HDFC Credit Card', 'credit_card'],
      ['Yes Bank', 'savings'],
    ]),
    debitCards: [{ account: 'Kotak Mahindra Bank' }],
    recurringAccounts: ['SBI', null],
    createdBy: new Map<string, string | null>([
      ['My Chit Fund', 'u1'],
      ['Yes Bank', null],
      ['Axis Bank', 'someone-else'], // a legacy row copied from another user's global list
    ]),
    userId: 'u1',
  }

  it('keeps every account with activity, a balance, a card, a bill, a type or a creator', () => {
    expect([...accountsInUse(base)].sort()).toEqual([
      'Cash', // non-default kind
      'HDFC Bank', // transactions
      'HDFC Credit Card', // transfer target + kind
      'ICICI Bank', // opening balance
      'Kotak Mahindra Bank', // debit card
      'My Chit Fund', // user added it
      'SBI', // recurring item
    ])
  })

  it('ignores names that are not accounts any more', () => {
    const used = accountsInUse({ ...base, transactions: [{ account: 'Deleted Bank', to_account: null }] })
    expect(used.has('Deleted Bank')).toBe(false)
  })

  it('only counts accounts created by this user', () => {
    expect(accountsInUse({ ...base, userId: null }).has('My Chit Fund')).toBe(false)
  })

  it('never counts a closed account, however much history it has', () => {
    const used = accountsInUse({ ...base, closed: new Set(['HDFC Bank', 'HDFC Credit Card']) })
    expect(used.has('HDFC Bank')).toBe(false)
    expect(used.has('HDFC Credit Card')).toBe(false)
    expect(used.has('ICICI Bank')).toBe(true)
  })
})
