import { describe, expect, it } from 'vitest'
import { matchAccountName, openingBalanceForToday, parseBalance } from '@/lib/onboardingAccounts'

describe('openingBalanceForToday', () => {
  it('is the balance itself for an account with no transactions', () => {
    expect(openingBalanceForToday(214600, 0, 0)).toBe(214600)
    expect(openingBalanceForToday(-8240, 0, 0)).toBe(-8240)
  })

  it('subtracts what logged transactions already contribute', () => {
    // Opening 1000, transactions net -300 -> shows 700. User says it holds 5000 today.
    expect(openingBalanceForToday(5000, 700, 1000)).toBe(5300)
    // No opening yet, transactions net +250.10.
    expect(openingBalanceForToday(1000, 250.1, 0)).toBe(749.9)
  })
})

describe('matchAccountName', () => {
  const accounts = ['Cash', 'HDFC Bank', 'Axis Bank']

  it('matches ignoring case and spaces, returning the stored spelling', () => {
    expect(matchAccountName('  hdfc bank ', accounts)).toBe('HDFC Bank')
    expect(matchAccountName('CASH', accounts)).toBe('Cash')
  })

  it('returns null for new or empty names', () => {
    expect(matchAccountName('Axis Card', accounts)).toBeNull()
    expect(matchAccountName('   ', accounts)).toBeNull()
  })
})

describe('parseBalance', () => {
  it('parses positives, negatives and thousands separators', () => {
    expect(parseBalance('2,14,600')).toBe(214600)
    expect(parseBalance('-8240')).toBe(-8240)
    expect(parseBalance('−8,240.5')).toBe(-8240.5)
    expect(parseBalance('')).toBe(0)
  })

  it('rejects non-numbers', () => {
    expect(parseBalance('abc')).toBeNull()
    expect(parseBalance('12-3')).toBeNull()
  })
})
