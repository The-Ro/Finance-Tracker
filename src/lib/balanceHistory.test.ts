import { describe, expect, it } from 'vitest'
import { monthEndBalances } from './balanceHistory'

describe('monthEndBalances', () => {
  it('accumulates income and expenses month by month, ignoring transfers', () => {
    const tx = [
      { type: 'income', date: '2026-07-05', amount: 1000 },
      { type: 'expense', date: '2026-08-10', amount: 200 },
      { type: 'transfer', date: '2026-08-11', amount: 500 },
      { type: 'expense', date: '2026-09-02', amount: 50.5 },
    ]
    expect(monthEndBalances(tx, 100, 3, '2026-09-27')).toEqual([
      { month: '2026-07', total: 1100 },
      { month: '2026-08', total: 900 },
      { month: '2026-09', total: 849.5 },
    ])
  })
  it('crosses a year boundary', () => {
    expect(monthEndBalances([], 0, 3, '2026-01-15').map((b) => b.month)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})
