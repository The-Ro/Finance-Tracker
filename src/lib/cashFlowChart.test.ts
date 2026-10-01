import { describe, expect, it } from 'vitest'
import { lineChartLayout, smoothPath } from './cashFlowChart'

const months = [
  { month: '2026-09', income: 3000, spent: 35299 },
  { month: '2026-10', income: 59091, spent: 545 },
]

describe('lineChartLayout', () => {
  it('spaces months evenly across the width', () => {
    const l = lineChartLayout(months, 300, 160)
    expect(l.xs).toEqual([75, 225])
  })

  it('never puts a point below the zero line', () => {
    const l = lineChartLayout([...months, { month: '2026-11', income: 0, spent: 0 }], 300, 160)
    for (const p of [...l.income, ...l.spent]) {
      expect(p.y).toBeLessThanOrEqual(l.baseline)
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
    expect(l.income[2].y).toBe(160)
  })

  it('puts the biggest value near the top, with a little room', () => {
    const l = lineChartLayout(months, 300, 160)
    expect(l.income[1].y).toBeGreaterThan(12)
    expect(l.income[1].y).toBeLessThan(25)
    expect(l.spent[1].y).toBeGreaterThan(155)
  })

  it('closes the money-in area down to the baseline', () => {
    const l = lineChartLayout(months, 300, 160)
    expect(l.incomeArea.endsWith('L75,160 Z')).toBe(true)
  })

  it('copes with no money at all', () => {
    const l = lineChartLayout([{ month: '2026-10', income: 0, spent: 0 }], 300, 160)
    expect(l.income[0].y).toBe(160)
  })
})

describe('smoothPath', () => {
  it('starts at the first point and keeps control points level with their ends', () => {
    expect(smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }])).toBe('M0,10 C5,10 5,0 10,0')
    expect(smoothPath([])).toBe('')
  })
})
