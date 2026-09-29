import { describe, expect, it } from 'vitest'
import { accountsForMode, cardSupportsUpi } from './cardNetworks'

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
  it('shows every account plus RuPay credit cards for UPI', () => {
    expect(accountsForMode('UPI', accounts)).toEqual(['HDFC Bank', 'Cash', 'Paytm', 'Axis RuPay CC'])
  })
  it('shows non-card accounts for any other mode, and everything without a mode', () => {
    expect(accountsForMode('Net banking', accounts)).toEqual(['HDFC Bank', 'Cash', 'Paytm'])
    expect(accountsForMode(null, accounts)).toHaveLength(5)
  })
})

describe('cardSupportsUpi', () => {
  it('is only true for a RuPay credit card', () => {
    expect(cardSupportsUpi('credit_card', 'rupay')).toBe(true)
    expect(cardSupportsUpi('credit_card', 'visa')).toBe(false)
    expect(cardSupportsUpi('savings', 'rupay')).toBe(false)
  })
})
