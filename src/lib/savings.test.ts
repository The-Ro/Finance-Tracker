import { describe, expect, it } from 'vitest'
import { averageSaved, lastMonths, monthlySavings, savingsChartGeometry, savingsHeadline, shiftMonth, smoothPath } from './savings'

const tx = (type: string, date: string, amount: number) => ({ type, date, amount })

describe('shiftMonth / lastMonths', () => {
  it('crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-03', -15)).toBe('2024-12')
  })

  it('lists the last N months ending with the month of today, oldest first', () => {
    expect(lastMonths('2026-02-10', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('monthlySavings', () => {
  it('buckets income minus spending by the stored local date, ignoring transfers and older months', () => {
    const rows = monthlySavings(
      [
        tx('income', '2026-09-01', 1000),
        tx('expense', '2026-09-30', 300.25),
        tx('transfer', '2026-09-15', 5000),
        tx('expense', '2026-08-31', 200),
        tx('income', '2026-03-31', 999), // just outside a 6-month window ending September
      ],
      '2026-09-27',
      6
    )
    expect(rows.map((r) => r.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(rows[5]).toEqual({ month: '2026-09', income: 1000, expense: 300.25, saved: 699.75 })
    expect(rows[4].saved).toBe(-200)
    expect(rows[0]).toEqual({ month: '2026-04', income: 0, expense: 0, saved: 0 })
  })

  it('treats the first day of a month as that month (no UTC shift)', () => {
    const rows = monthlySavings([tx('income', '2026-09-01', 50)], '2026-09-01', 2)
    expect(rows[1]).toMatchObject({ month: '2026-09', saved: 50 })
    expect(rows[0]).toMatchObject({ month: '2026-08', saved: 0 })
  })
})

describe('averageSaved', () => {
  it('averages from the first month with activity', () => {
    const rows = monthlySavings(
      [tx('income', '2026-08-02', 100), tx('income', '2026-09-02', 300)],
      '2026-09-27',
      6
    )
    expect(averageSaved(rows)).toEqual({ average: 200, months: 2 })
  })

  it('is zero with no activity at all', () => {
    expect(averageSaved(monthlySavings([], '2026-09-27', 6))).toEqual({ average: 0, months: 0 })
  })
})

describe('savingsHeadline', () => {
  it('gives this month, the share of income kept and whether it is the best month', () => {
    const rows = monthlySavings(
      [tx('income', '2026-08-02', 1000), tx('expense', '2026-08-03', 900), tx('income', '2026-09-02', 1000), tx('expense', '2026-09-03', 750)],
      '2026-09-27',
      6
    )
    const h = savingsHeadline(rows)
    expect(h.saved).toBe(250)
    expect(h.income).toBe(1000)
    expect(h.rate).toBe(25)
    expect(h.isBest).toBe(true)
  })

  it('has no rate without income and is never best on its own or when negative', () => {
    const only = savingsHeadline(monthlySavings([tx('expense', '2026-09-03', 10)], '2026-09-27', 6))
    expect(only.rate).toBeNull()
    expect(only.isBest).toBe(false)
    const first = savingsHeadline(monthlySavings([tx('income', '2026-09-03', 10)], '2026-09-27', 6))
    expect(first.isBest).toBe(false)
  })
})

describe('savingsChartGeometry', () => {
  it('centres each point in its column and keeps zero inside the range', () => {
    const g = savingsChartGeometry([100, -100, 300], 300, 100, { padTop: 0, padBottom: 0 })
    expect(g.points.map((p) => p.x)).toEqual([50, 150, 250])
    expect(g.points[2].y).toBe(0) // max at the top
    expect(g.points[1].y).toBe(100) // min at the bottom
    expect(g.zeroY).toBe(75)
    expect(g.line.startsWith('M50 ')).toBe(true)
    expect(g.area.endsWith('L250 75 L50 75 Z')).toBe(true)
  })

  it('puts the baseline at the bottom when every month is positive', () => {
    const g = savingsChartGeometry([10, 20], 200, 100, { padTop: 10, padBottom: 10 })
    expect(g.zeroY).toBe(90)
    expect(g.points[1].y).toBe(10)
  })

  it('handles an all-zero series without dividing by zero', () => {
    const g = savingsChartGeometry([0, 0, 0], 90, 50)
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true)
  })
})

describe('smoothPath', () => {
  it('handles 0, 1 and many points', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M1 2')
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ])
    expect(d.startsWith('M0 0 C')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(2)
  })

  it('never overshoots a flat stretch (monotone)', () => {
    const d = smoothPath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 0 },
    ])
    // The first segment's control points stay on y=50.
    expect(d.split(' C')[1]).toMatch(/^\S+ 50 \S+ 50 10 50$/)
  })
})
