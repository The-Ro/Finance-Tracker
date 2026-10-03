import { describe, expect, it } from 'vitest'
import { netWorth, type NetWorthInput } from './netWorth'
import type { AccountKind } from '@/types/database.types'

const base = (over: Partial<NetWorthInput> = {}): NetWorthInput => ({
  balances: new Map(),
  kinds: new Map(),
  closed: new Set(),
  invested: 0,
  lentOut: 0,
  borrowed: 0,
  splitsOwedToYou: 0,
  splitsYouOwe: 0,
  loansLeft: 0,
  otherAssets: 0,
  otherDebts: 0,
  ...over,
})

describe('netWorth', () => {
  it('adds what you own and takes off what you owe', () => {
    const r = netWorth(
      base({
        balances: new Map([
          ['HDFC', 50000],
          ['Cash', 2000],
          ['Amex', -12000],
        ]),
        kinds: new Map<string, AccountKind>([
          ['HDFC', 'savings'],
          ['Cash', 'cash'],
          ['Amex', 'credit_card'],
        ]),
        invested: 30000,
        lentOut: 5000,
        splitsOwedToYou: 500,
        borrowed: 1000,
        loansLeft: 40000,
        otherAssets: 100000,
        otherDebts: 2500,
      })
    )
    expect(r.ownTotal).toBe(187500)
    expect(r.oweTotal).toBe(55500)
    expect(r.total).toBe(132000)
    expect(r.own.map((l) => l.key)).toEqual(['other', 'accounts', 'investments', 'owedToYou'])
    expect(r.owe.map((l) => l.key)).toEqual(['loans', 'cards', 'otherDebts', 'youOwe'])
  })

  it('leaves out closed accounts and zero lines', () => {
    const r = netWorth(
      base({
        balances: new Map([
          ['Old bank', 9999],
          ['SBI', 100],
        ]),
        closed: new Set(['Old bank']),
      })
    )
    expect(r.total).toBe(100)
    expect(r.own).toEqual([{ key: 'accounts', label: 'Banks, cash and wallets', amount: 100 }])
    expect(r.owe).toEqual([])
  })

  it('counts a card in credit as yours and an overdrawn bank against your accounts', () => {
    const r = netWorth(
      base({
        balances: new Map([
          ['Card', 300],
          ['Bank', -200],
        ]),
        kinds: new Map<string, AccountKind>([
          ['Card', 'credit_card'],
          ['Bank', 'savings'],
        ]),
      })
    )
    expect(r.total).toBe(100)
    expect(r.owe).toEqual([])
  })

  it('can go below zero', () => {
    expect(netWorth(base({ loansLeft: 1000 })).total).toBe(-1000)
  })
})
