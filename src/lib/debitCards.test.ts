import { describe, expect, it } from 'vitest'
import { debitCardLabel, debitCardsByAccount, looksLikeDebitCardAccount, normalizeLast4, selectionForDebitCard, type DebitCard } from './debitCards'

const card = (over: Partial<DebitCard>): DebitCard => ({
  id: 'c1',
  owner_user_id: 'u1',
  name: 'HDFC Millennia',
  last4: '1234',
  account: 'HDFC Bank',
  network: null,
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})

describe('debit cards', () => {
  it('labels a card with its last 4 digits when known', () => {
    expect(debitCardLabel(card({}))).toBe('HDFC Millennia ••1234')
    expect(debitCardLabel(card({ last4: null }))).toBe('HDFC Millennia')
  })

  it('selecting a card spends from its linked account, as a debit-card payment', () => {
    expect(selectionForDebitCard(card({ id: 'x', account: 'SBI Savings' }))).toEqual({
      account: 'SBI Savings',
      debitCardId: 'x',
      paymentMethod: 'Debit card',
    })
  })

  it('flags old accounts whose name says debit card, whatever their kind', () => {
    expect(looksLikeDebitCardAccount('HDFC Debit Card')).toBe(true)
    expect(looksLikeDebitCardAccount('sbi debit')).toBe(true)
    expect(looksLikeDebitCardAccount('HDFC Credit Card')).toBe(false)
    expect(looksLikeDebitCardAccount('Debitel Wallet')).toBe(false)
  })

  it('groups cards under their account in name order', () => {
    const map = debitCardsByAccount([
      card({ id: 'b', name: 'Visa' }),
      card({ id: 'a', name: 'Rupay' }),
      card({ id: 'c', name: 'Classic', account: 'SBI' }),
    ])
    expect(map.get('HDFC Bank')?.map((c) => c.id)).toEqual(['a', 'b'])
    expect(map.get('SBI')?.map((c) => c.id)).toEqual(['c'])
  })

  it('normalizes last 4 digits', () => {
    expect(normalizeLast4(' 12 34 ')).toBe('1234')
    expect(normalizeLast4('')).toBeNull()
    expect(normalizeLast4(null)).toBeNull()
    expect(() => normalizeLast4('12a4')).toThrow()
    expect(() => normalizeLast4('12345')).toThrow()
  })
})
