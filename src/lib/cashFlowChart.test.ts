import { describe, expect, it } from 'vitest'
import { inOutWidths, keptStrip } from './cashFlowChart'

describe('keptStrip', () => {
  it('gives each month what it kept, with room above and below in proportion', () => {
    const s = keptStrip([
      { month: '2026-09', income: 3000, spent: 35299 },
      { month: '2026-10', income: 59091, spent: 545 },
    ])
    expect(s.bars[0].kept).toBe(-32299)
    expect(s.bars[1].kept).toBe(58546)
    expect(s.baseline).toBeCloseTo(58546 / (58546 + 32299))
    expect(s.bars[0].height + s.bars[1].height).toBeCloseTo(1)
  })

  it('puts the line at the bottom when every month kept money', () => {
    const s = keptStrip([
      { month: '2026-09', income: 100, spent: 50 },
      { month: '2026-10', income: 100, spent: 0 },
    ])
    expect(s.baseline).toBe(1)
    expect(s.bars[1].height).toBe(1)
    expect(s.bars[0].height).toBe(0.5)
  })

  it('marks empty months and copes with nothing at all', () => {
    const s = keptStrip([{ month: '2026-10', income: 0, spent: 0 }])
    expect(s.bars[0].empty).toBe(true)
    expect(s.bars[0].height).toBe(0)
  })
})

describe('inOutWidths', () => {
  it('scales both to the larger one', () => {
    expect(inOutWidths(59091, 545).income).toBe(1)
    expect(inOutWidths(59091, 545).spent).toBeCloseTo(545 / 59091)
    expect(inOutWidths(0, 0)).toEqual({ income: 0, spent: 0 })
  })
})
