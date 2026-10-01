import { describe, expect, it } from 'vitest'
import { cashFlowLayout } from './cashFlowChart'

describe('cashFlowLayout', () => {
  it('puts the baseline where the biggest in and out meet', () => {
    const l = cashFlowLayout([
      { month: '2026-09', income: 3000, spent: 1000 },
      { month: '2026-10', income: 1000, spent: 2000 },
    ])
    // max in 3000, max out 2000 -> baseline at 3/5 from the top
    expect(l.baseline).toBeCloseTo(0.6)
    expect(l.columns[0].inHeight).toBeCloseTo(0.6)
    expect(l.columns[1].outHeight).toBeCloseTo(0.4)
  })

  it('places kept above the baseline when you kept money, below when you spent more', () => {
    const l = cashFlowLayout([
      { month: '2026-09', income: 3000, spent: 1000 },
      { month: '2026-10', income: 1000, spent: 2000 },
    ])
    expect(l.columns[0].keptY).toBeCloseTo(0.6 - 2000 / 5000)
    expect(l.columns[1].keptY).toBeCloseTo(0.6 + 1000 / 5000)
  })

  it('leaves empty months off the kept line', () => {
    const l = cashFlowLayout([
      { month: '2026-07', income: 0, spent: 0 },
      { month: '2026-08', income: 10, spent: 5 },
      { month: '2026-09', income: 0, spent: 0 },
      { month: '2026-10', income: 4, spent: 9 },
      { month: '2026-11', income: 2, spent: 1 },
    ])
    expect(l.columns[0].empty).toBe(true)
    expect(l.segments).toEqual([[1], [3, 4]])
  })

  it('copes with nothing logged at all', () => {
    const l = cashFlowLayout([{ month: '2026-10', income: 0, spent: 0 }])
    expect(l.baseline).toBe(0.5)
    expect(l.columns[0].keptY).toBe(0.5)
    expect(l.segments).toEqual([])
  })
})
