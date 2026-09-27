import { describe, expect, it } from 'vitest'
import { sparkPath } from './sparkPath'

describe('sparkPath', () => {
  it('returns empty geometry for no values', () => {
    expect(sparkPath([], { width: 100, height: 50 })).toEqual({ line: '', area: '', points: [], zeroY: null })
  })

  it('spreads points evenly across the padded width', () => {
    const { points } = sparkPath([1, 2, 3], { width: 120, height: 60, padX: 10, padY: 5 })
    expect(points.map((p) => p.x)).toEqual([10, 60, 110])
  })

  it('puts the max at the top and the min at the bottom of the padded plot', () => {
    const { points } = sparkPath([0, 10, 5], { width: 100, height: 60, padY: 10 })
    expect(points[0].y).toBe(50)
    expect(points[1].y).toBe(10)
    expect(points[2].y).toBe(30)
  })

  it('centres a flat series vertically', () => {
    const { points } = sparkPath([4, 4, 4], { width: 100, height: 60 })
    expect(points.every((p) => p.y === 30)).toBe(true)
  })

  it('centres a single point', () => {
    const { points, line } = sparkPath([7], { width: 100, height: 60 })
    expect(points).toEqual([{ x: 50, y: 30, value: 7 }])
    expect(line).toBe('M50 30')
  })

  it('draws one cubic segment per gap and ends on the last point', () => {
    const { line, points } = sparkPath([3, 1, 4, 1], { width: 300, height: 100 })
    expect(line.startsWith(`M${points[0].x} ${points[0].y}`)).toBe(true)
    expect(line.match(/C/g)).toHaveLength(3)
    const last = points[points.length - 1]
    expect(line.endsWith(`${last.x} ${last.y}`)).toBe(true)
  })

  it('closes the area down to the baseline', () => {
    const { area, line, points } = sparkPath([1, 3, 2], { width: 200, height: 80, padX: 8, padY: 6 })
    expect(area.startsWith(line)).toBe(true)
    expect(area.endsWith(`L${points[2].x} 74 L${points[0].x} 74 Z`)).toBe(true)
  })

  it('reports the zero line only when zero is within range', () => {
    expect(sparkPath([-10, 10], { width: 100, height: 100 }).zeroY).toBe(50)
    expect(sparkPath([5, 10], { width: 100, height: 100 }).zeroY).toBeNull()
  })
})
