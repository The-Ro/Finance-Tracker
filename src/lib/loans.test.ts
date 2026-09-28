import { describe, expect, it } from 'vitest'
import { emiFor, loanDetailsOf, loanProgress, monthsBetween, supportsLoanDetails } from './loans'

const bike = { amount: 250000, tenureMonths: 24, startMonth: '2025-11' }

describe('monthsBetween', () => {
  it('counts whole months across years, negative backwards', () => {
    expect(monthsBetween('2025-11', '2026-09')).toBe(10)
    expect(monthsBetween('2026-09', '2026-09')).toBe(0)
    expect(monthsBetween('2026-09', '2026-07')).toBe(-2)
  })
})

describe('loanProgress', () => {
  it('counts every EMI due before the next due date as paid', () => {
    // First EMI Nov 2025, next one due Oct 2026: Nov..Sep = 11 paid.
    expect(loanProgress(bike, 12478, 'monthly', '2026-10-05')).toEqual({
      paid: 11,
      total: 24,
      remaining: 13,
      paidAmount: 137258,
      totalPayable: 299472,
      interest: 49472,
      endMonth: '2027-10',
      done: false,
    })
  })
  it('is zero before the first EMI and caps at the tenure once finished', () => {
    expect(loanProgress(bike, 12478, 'monthly', '2025-11-05')?.paid).toBe(0)
    expect(loanProgress(bike, 12478, 'monthly', '2025-08-05')?.paid).toBe(0)
    const finished = loanProgress(bike, 12478, 'monthly', '2028-01-05')!
    expect(finished.paid).toBe(24)
    expect(finished.remaining).toBe(0)
    expect(finished.done).toBe(true)
  })
  it('steps by the cadence and never reports negative interest', () => {
    const quarterly = loanProgress({ amount: 1000, tenureMonths: 12, startMonth: '2026-01' }, 200, 'quarterly', '2026-07-01')!
    expect(quarterly).toMatchObject({ paid: 2, total: 4, endMonth: '2026-10', interest: 0 })
  })
  it('has no schedule for weekly items', () => {
    expect(supportsLoanDetails('weekly')).toBe(false)
    expect(loanProgress(bike, 100, 'weekly', '2026-10-05')).toBeNull()
  })
})

describe('emiFor', () => {
  it('uses the reducing-balance EMI formula, and splits evenly at 0%', () => {
    // ₹2,50,000 at 10.5% for 24 months -> ₹11,594.01 (EMI calculators show ₹11,594).
    expect(emiFor(250000, 10.5, 24)).toBe(11594.01)
    expect(emiFor(120000, 0, 12)).toBe(10000)
    expect(emiFor(0, 10, 12)).toBe(0)
  })
})

describe('loanDetailsOf', () => {
  it('needs all three fields', () => {
    expect(loanDetailsOf({ loan_amount: 5000, loan_tenure_months: 12, loan_start_date: '2026-01-01' })).toEqual({
      amount: 5000,
      tenureMonths: 12,
      startMonth: '2026-01',
      interestRate: null,
    })
    expect(
      loanDetailsOf({ loan_amount: 5000, loan_tenure_months: 12, loan_start_date: '2026-01-01', loan_interest_rate: 10.5 })
        ?.interestRate
    ).toBe(10.5)
    expect(loanDetailsOf({ loan_amount: 5000, loan_tenure_months: null, loan_start_date: '2026-01-01' })).toBeNull()
  })
})
