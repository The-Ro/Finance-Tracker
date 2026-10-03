import { describe, expect, it } from 'vitest'
import { quickAddFromParams } from './quickAddLink'

const p = (q: string) => quickAddFromParams(new URLSearchParams(q))

describe('quickAddFromParams', () => {
  it('reads amount, payee, category and date', () => {
    expect(p('amount=450&payee=Swiggy&category=Dining&date=2026-10-04')).toEqual({
      amount: 450,
      merchant: 'Swiggy',
      category: 'Dining',
      date: '2026-10-04',
    })
  })

  it('cleans up amounts and takes a note as the payee', () => {
    expect(p('amount=%E2%82%B91,250.50&note=Dinner')).toEqual({ amount: 1250.5, merchant: 'Dinner' })
  })

  it('ignores bad values', () => {
    expect(p('amount=-5&date=2026-13-40')).toEqual({})
    expect(p('amount=abc')).toEqual({})
  })
})
