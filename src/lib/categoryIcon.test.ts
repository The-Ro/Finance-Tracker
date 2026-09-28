import { describe, expect, it } from 'vitest'
import { categoryIconKey } from './categoryIcon'

describe('categoryIconKey', () => {
  it('maps built-in categories (any case) and transfers', () => {
    expect(categoryIconKey('Dining')).toBe('dining')
    expect(categoryIconKey('groceries')).toBe('basket')
    expect(categoryIconKey('Fees & charges')).toBe('receipt')
    expect(categoryIconKey('Salary', 'income')).toBe('salary')
    expect(categoryIconKey(null, 'transfer')).toBe('transfer')
  })
  it('matches custom categories by keyword, else a plain tag', () => {
    expect(categoryIconKey('Loan')).toBe('loan')
    expect(categoryIconKey('Bike EMI')).toBe('loan')
    expect(categoryIconKey('Investments')).toBe('trending')
    expect(categoryIconKey('Petrol')).toBe('fuel')
    expect(categoryIconKey('Mobile recharge')).toBe('phone')
    expect(categoryIconKey('Zorblax')).toBe('tag')
    expect(categoryIconKey('')).toBe('tag')
  })
})
