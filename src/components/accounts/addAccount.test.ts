import { describe, expect, it } from 'vitest'
import type { AccountKind } from '@/lib/creditCards'
import { addTypeForKind, defaultDebitCardName, permanentCashAccount } from './addAccount'

describe('addTypeForKind', () => {
  it('maps each account kind to the flow type that adds it', () => {
    expect(addTypeForKind('savings')).toBe('bank')
    expect(addTypeForKind('current')).toBe('bank')
    expect(addTypeForKind('credit_card')).toBe('credit')
    expect(addTypeForKind('wallet')).toBe('wallet')
    expect(addTypeForKind('cash')).toBe('wallet')
  })
})

describe('defaultDebitCardName', () => {
  it('names the card after its bank', () => {
    expect(defaultDebitCardName(' HDFC Bank ')).toBe('HDFC Bank Debit')
    expect(defaultDebitCardName('')).toBe('')
  })
})

describe('permanentCashAccount', () => {
  const kinds = new Map<string, AccountKind>([
    ['Wallet cash', 'cash'],
    ['Cash', 'cash'],
    ['HDFC Bank', 'savings'],
  ])

  it('prefers the account called Cash', () => {
    expect(permanentCashAccount(['Wallet cash', 'Cash', 'HDFC Bank'], kinds)).toBe('Cash')
  })

  it('falls back to the first cash account, or null without one', () => {
    expect(permanentCashAccount(['Wallet cash', 'HDFC Bank'], kinds)).toBe('Wallet cash')
    expect(permanentCashAccount(['HDFC Bank'], kinds)).toBeNull()
  })

  it('ignores an account called Cash that is not a cash account', () => {
    expect(permanentCashAccount(['Cash'], new Map<string, AccountKind>([['Cash', 'wallet']]))).toBeNull()
  })
})
