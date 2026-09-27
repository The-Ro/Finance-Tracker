import { describe, expect, it } from 'vitest'
import { countSecondaryFields, currencySymbol, orderAccountOptions, savedEntryMessage } from './entryForm'

const all = ['HDFC Bank', 'Axis Card', 'Cash', 'Wallet']

describe('orderAccountOptions', () => {
  it('puts recent accounts first, then the rest in order', () => {
    expect(orderAccountOptions(all, ['Cash', 'Axis Card'])).toEqual(['Cash', 'Axis Card', 'HDFC Bank', 'Wallet'])
  })

  it('returns the full list when nothing is recent', () => {
    expect(orderAccountOptions(all, [])).toEqual(all)
  })

  it('skips recent accounts that no longer exist', () => {
    expect(orderAccountOptions(all, ['Old Bank', 'Wallet'])).toEqual(['Wallet', 'HDFC Bank', 'Axis Card', 'Cash'])
  })

  it('excludes the other side of a transfer', () => {
    expect(orderAccountOptions(all, ['Cash'], { exclude: 'Cash' })).toEqual(['HDFC Bank', 'Axis Card', 'Wallet'])
  })

  it('keeps a selected account that is missing from the list, up front', () => {
    expect(orderAccountOptions(all, ['Cash'], { selected: 'Old Bank' })).toEqual([
      'Old Bank',
      'Cash',
      'HDFC Bank',
      'Axis Card',
      'Wallet',
    ])
  })

  it('does not duplicate a selected account that is already listed', () => {
    expect(orderAccountOptions(all, [], { selected: 'Cash' })).toEqual(all)
  })

  it('ignores empty names', () => {
    expect(orderAccountOptions(['', 'Cash'], [''], { selected: '' })).toEqual(['Cash'])
  })
})

describe('countSecondaryFields', () => {
  it('is zero for an entry with nothing extra', () => {
    expect(countSecondaryFields({ payment_method: null, remarks: null, tags: [], receipt: false })).toBe(0)
  })

  it('counts each filled field once', () => {
    expect(countSecondaryFields({ payment_method: 'UPI', remarks: 'dinner', tags: ['trip', 'food'], receipt: true })).toBe(4)
  })

  it('treats whitespace-only remarks as empty', () => {
    expect(countSecondaryFields({ remarks: '   ' })).toBe(0)
  })
})

describe('currencySymbol', () => {
  it('returns the listed symbol', () => {
    expect(currencySymbol('INR')).toBe('₹')
    expect(currencySymbol('CAD')).toBe('CA$')
  })

  it('falls back to the code', () => {
    expect(currencySymbol('NZD')).toBe('NZD')
  })
})

describe('savedEntryMessage', () => {
  it('includes the merchant and amount', () => {
    expect(savedEntryMessage('  Fresh Mart ', '₹1,284.00')).toBe('Saved · Fresh Mart ₹1,284.00')
  })

  it('drops an empty merchant', () => {
    expect(savedEntryMessage(' ', '$5.00')).toBe('Saved · $5.00')
  })
})
