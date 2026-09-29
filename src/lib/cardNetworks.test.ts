import { describe, expect, it } from 'vitest'
import { accountsForMode, cardSupportsUpi, modeUsesDebitCards } from './cardNetworks'

const accounts = [
  { name: 'HDFC Bank', kind: 'savings' as const },
  { name: 'Cash', kind: 'cash' as const },
  { name: 'Paytm', kind: 'wallet' as const },
  { name: 'Axis RuPay CC', kind: 'credit_card' as const, network: 'rupay' as const },
  { name: 'HDFC Visa CC', kind: 'credit_card' as const, network: 'visa' as const },
]

describe('accountsForMode', () => {
  it('shows only credit cards for "Credit card"', () => {
    expect(accountsForMode('Credit card', accounts)).toEqual(['Axis RuPay CC', 'HDFC Visa CC'])
  })
  it('shows banks, wallets and RuPay credit cards for UPI (not cash)', () => {
    expect(accountsForMode('UPI', accounts)).toEqual(['HDFC Bank', 'Paytm', 'Axis RuPay CC'])
  })
  it('shows only cash for "Cash" and only wallets for "Wallet"', () => {
    expect(accountsForMode('Cash', accounts)).toEqual(['Cash'])
    expect(accountsForMode('Wallet', accounts)).toEqual(['Paytm'])
  })
  it('shows only banks for "Debit card" and the bank-only modes', () => {
    expect(accountsForMode('Debit card', accounts)).toEqual(['HDFC Bank'])
    expect(accountsForMode('Net banking', accounts)).toEqual(['HDFC Bank'])
    expect(accountsForMode('NEFT/RTGS/IMPS', accounts)).toEqual(['HDFC Bank'])
  })
  it('shows everything without a mode or for "Other"', () => {
    expect(accountsForMode(null, accounts)).toHaveLength(5)
    expect(accountsForMode('Other', accounts)).toHaveLength(5)
  })
  it('counts an unknown kind as a bank', () => {
    expect(accountsForMode('Net banking', [{ name: 'Old', kind: undefined }])).toEqual(['Old'])
  })
})

describe('modeUsesDebitCards', () => {
  it('offers debit cards only with no mode, "Debit card" or "Other"', () => {
    expect([null, '', 'Debit card', 'Other'].map(modeUsesDebitCards)).toEqual([true, true, true, true])
    expect(['Credit card', 'Cash', 'Wallet', 'UPI', 'Net banking'].map(modeUsesDebitCards)).toEqual([false, false, false, false, false])
  })
})

describe('cardSupportsUpi', () => {
  it('is only true for a RuPay credit card', () => {
    expect(cardSupportsUpi('credit_card', 'rupay')).toBe(true)
    expect(cardSupportsUpi('credit_card', 'visa')).toBe(false)
    expect(cardSupportsUpi('savings', 'rupay')).toBe(false)
  })
})
