import { describe, expect, it } from 'vitest'
import { planBankSetup } from './bankSetup'
import type { AccountKind } from './creditCards'

const kinds = new Map<string, AccountKind>([
  ['Cash', 'cash'],
  ['HDFC Bank', 'savings'],
  ['ICICI Bank', 'savings'],
  ['Axis Bank', 'savings'],
  ['Yes Bank', 'savings'],
  ['My Visa', 'credit_card'],
])
const base = {
  accounts: ['Cash', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Yes Bank', 'My Visa'],
  kinds,
  // Axis has transactions; the rest of the banks are untouched seeds.
  inUse: new Set(['Cash', 'Axis Bank', 'My Visa']),
  createdBy: new Map<string, string | null>([
    ['Cash', null],
    ['HDFC Bank', null],
    ['ICICI Bank', null],
    ['Axis Bank', null],
    ['Yes Bank', null],
    ['My Visa', 'u1'],
  ]),
}

describe('planBankSetup', () => {
  it('adopts picked seeds, updates used banks, adds new ones and removes untouched seeds', () => {
    const plan = planBankSetup({
      ...base,
      chosen: new Map([
        ['HDFC Bank', { kind: 'savings' as const, balance: 42000 }],
        ['Axis Bank', { kind: 'current' as const, balance: null }],
        ['Kotak 811', { kind: 'savings' as const, balance: 500 }],
      ]),
    })
    expect(plan.adopt).toEqual([{ name: 'HDFC Bank', kind: 'savings', opening: 42000 }])
    expect(plan.update).toEqual([{ name: 'Axis Bank', kind: 'current' }])
    expect(plan.create).toEqual([{ name: 'Kotak 811', kind: 'savings', opening: 500 }])
    // Cash (not a bank), the card and Axis (in use) are never removed.
    expect(plan.remove).toEqual(['ICICI Bank', 'Yes Bank'])
  })

  it('never removes a bank in use, even when it is not picked', () => {
    const plan = planBankSetup({ ...base, chosen: new Map() })
    expect(plan.remove).toEqual(['HDFC Bank', 'ICICI Bank', 'Yes Bank'])
    expect(plan.update).toEqual([])
  })
})
