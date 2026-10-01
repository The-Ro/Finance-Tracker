/**
 * Review's "Money in and out" line chart: a smooth line for money in and one
 * for money out over the last months, both on one scale that starts at zero
 * (nothing ever goes below the baseline). Everything is in real pixels for
 * the width the chart is drawn at, so the SVG is never stretched.
 */
export interface CashFlowMonth {
  month: string
  income: number
  spent: number
}

export interface ChartPoint {
  x: number
  y: number
}

export interface LineChartLayout {
  /** x of each month's centre. */
  xs: number[]
  income: ChartPoint[]
  spent: ChartPoint[]
  incomePath: string
  spentPath: string
  /** The money-in line closed down to the baseline, for its soft fill. */
  incomeArea: string
  /** y of the zero line. */
  baseline: number
  /** y of the half-way grid line and its value. */
  midY: number
  midValue: number
}

const r = (n: number) => Math.round(n * 10) / 10

/** A smooth path through the points (horizontal-tangent cubic segments, so it never overshoots below zero). */
export function smoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return ''
  let d = `M${r(points[0].x)},${r(points[0].y)}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const cx = r((a.x + b.x) / 2)
    d += ` C${cx},${r(a.y)} ${cx},${r(b.y)} ${r(b.x)},${r(b.y)}`
  }
  return d
}

export function lineChartLayout(months: CashFlowMonth[], width: number, height: number, padTop = 12): LineChartLayout {
  const n = Math.max(1, months.length)
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.spent))) * 1.08
  const baseline = height
  const x = (i: number) => ((i + 0.5) / n) * width
  const y = (v: number) => baseline - (Math.max(0, v) / max) * (height - padTop)
  const xs = months.map((_, i) => r(x(i)))
  const income = months.map((m, i) => ({ x: x(i), y: y(m.income) }))
  const spent = months.map((m, i) => ({ x: x(i), y: y(m.spent) }))
  const incomePath = smoothPath(income)
  const incomeArea = income.length
    ? `${incomePath} L${r(income[income.length - 1].x)},${baseline} L${r(income[0].x)},${baseline} Z`
    : ''
  return {
    xs,
    income: income.map((p) => ({ x: r(p.x), y: r(p.y) })),
    spent: spent.map((p) => ({ x: r(p.x), y: r(p.y) })),
    incomePath,
    spentPath: smoothPath(spent),
    incomeArea,
    baseline,
    midY: r(y(max / 1.08 / 2)),
    midValue: max / 1.08 / 2,
  }
}
