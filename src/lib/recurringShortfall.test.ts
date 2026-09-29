import { describe, expect, it } from 'vitest'
import { accountShortfalls } from './recurringShortfall'

describe('accountShortfalls', () => {
  const items = [
    { account: 'HDFC Bank', amount: 2000, active: true },
    { account: 'HDFC Bank', amount: 3000, active: true },
    { account: 'HDFC Bank', amount: 12478, active: true },
    { account: 'SBI', amount: 500, active: true },
    { account: 'HDFC Bank', amount: 9999, active: false },
    { account: null, amount: 100, active: true },
    { account: 'Axis Card', amount: 800, active: true },
  ]

  it('adds up active items per account and flags only the short ones', () => {
    const balances = new Map([['HDFC Bank', 1200], ['SBI', 5000], ['Axis Card', -4000]])
    const result = accountShortfalls(items, balances, (a) => a !== 'Axis Card')
    expect(result).toEqual([{ account: 'HDFC Bank', needed: 17478, balance: 1200, short: 16278, count: 3 }])
  })

  it('treats a missing balance as zero and sorts by shortfall', () => {
    const result = accountShortfalls(items, new Map())
    expect(result.map((s) => [s.account, s.short])).toEqual([
      ['HDFC Bank', 17478],
      ['Axis Card', 800],
      ['SBI', 500],
    ])
  })

  it('is empty when every account covers its payments', () => {
    expect(accountShortfalls(items, new Map([['HDFC Bank', 20000], ['SBI', 500], ['Axis Card', 800]]))).toEqual([])
  })
})
