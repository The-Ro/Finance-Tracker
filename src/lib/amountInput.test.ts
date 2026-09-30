import { describe, expect, it } from 'vitest'
import { cleanAmountInput, groupAmountInput } from './amountInput'

describe('cleanAmountInput', () => {
  it('keeps digits and one decimal point, two decimals at most', () => {
    expect(cleanAmountInput('62,000')).toBe('62000')
    expect(cleanAmountInput('₹ 1,23,456.789')).toBe('123456.78')
    expect(cleanAmountInput('12.3.4')).toBe('12.34')
    expect(cleanAmountInput('abc')).toBe('')
  })
  it('drops leading zeros but keeps 0 and 0.5', () => {
    expect(cleanAmountInput('0005')).toBe('5')
    expect(cleanAmountInput('0')).toBe('0')
    expect(cleanAmountInput('0.5')).toBe('0.5')
  })
})

describe('groupAmountInput', () => {
  it('adds commas to the whole part only', () => {
    expect(groupAmountInput('62000', 'en-US')).toBe('62,000')
    expect(groupAmountInput('1234567.5', 'en-US')).toBe('1,234,567.5')
    expect(groupAmountInput('123456', 'en-IN')).toBe('1,23,456')
  })
  it('keeps a trailing point while typing a decimal', () => {
    expect(groupAmountInput('1000.', 'en-US')).toBe('1,000.')
    expect(groupAmountInput('.5', 'en-US')).toBe('0.5')
    expect(groupAmountInput('', 'en-US')).toBe('')
  })
})
