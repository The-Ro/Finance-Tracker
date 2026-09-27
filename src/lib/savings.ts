// Savings flow (Home): what the user kept each month -- income minus spending.
// Transfers move money between the user's own accounts, so they never count.
// Month keys come straight from the stored local calendar date (YYYY-MM-DD),
// and month arithmetic is done on the numbers, never through toISOString().

interface SavingsTransaction {
  type: string
  date: string
  amount: number
}

export interface MonthSavings {
  /** YYYY-MM */
  month: string
  income: number
  expense: number
  /** income - expense (negative when the month spent more than it earned). */
  saved: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Shift a YYYY-MM key by `delta` months (Dec + 1 -> Jan of the next year). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  const year = Math.floor(idx / 12)
  const monthIndex = idx - year * 12
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

/** The last `count` month keys ending with the month of `today`, oldest first. */
export function lastMonths(today: string, count: number): string[] {
  const current = today.slice(0, 7)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(shiftMonth(current, -i))
  return out
}

/** Income, spending and savings for each of the last `count` months (oldest first). */
export function monthlySavings(transactions: SavingsTransaction[], today: string, count = 6): MonthSavings[] {
  const months = lastMonths(today, count)
  const buckets = new Map(months.map((m) => [m, { income: 0, expense: 0 }]))
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    const bucket = buckets.get(t.date.slice(0, 7))
    if (!bucket) continue
    if (t.type === 'income') bucket.income += t.amount
    else bucket.expense += t.amount
  }
  return months.map((month) => {
    const { income, expense } = buckets.get(month)!
    return { month, income: round2(income), expense: round2(expense), saved: round2(income - expense) }
  })
}

/**
 * Average monthly savings, counted from the first month with any activity --
 * a user who started two months ago isn't dragged down by four empty months.
 */
export function averageSaved(rows: MonthSavings[]): { average: number; months: number } {
  const first = rows.findIndex((r) => r.income !== 0 || r.expense !== 0)
  if (first === -1) return { average: 0, months: 0 }
  const active = rows.slice(first)
  return { average: round2(active.reduce((sum, r) => sum + r.saved, 0) / active.length), months: active.length }
}

export interface SavingsHeadline {
  saved: number
  income: number
  /** Share of income kept, 0-100 (can be negative); null without income. */
  rate: number | null
  /** The last month is the best of the window (and positive, with at least one earlier active month to beat). */
  isBest: boolean
}

/** "Saved this month" figures from the monthlySavings rows (last row = this month). */
export function savingsHeadline(rows: MonthSavings[]): SavingsHeadline {
  const current = rows[rows.length - 1] ?? { month: '', income: 0, expense: 0, saved: 0 }
  const earlier = rows.slice(0, -1).filter((r) => r.income !== 0 || r.expense !== 0)
  const isBest = current.saved > 0 && earlier.length > 0 && earlier.every((r) => current.saved > r.saved)
  return {
    saved: current.saved,
    income: current.income,
    rate: current.income > 0 ? (current.saved / current.income) * 100 : null,
    isBest,
  }
}

export interface ChartPoint {
  x: number
  y: number
  value: number
}

export interface SavingsChartGeometry {
  points: ChartPoint[]
  /** y of the zero baseline. */
  zeroY: number
  line: string
  /** The line closed down to the zero baseline, for the soft fill underneath. */
  area: string
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Smooth path through points with monotone cubic interpolation
 * (Fritsch-Carlson), so the curve never overshoots a point -- a month that
 * saved nothing is never drawn dipping below the zero line.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${r1(points[0].x)} ${r1(points[0].y)}`
  const h: number[] = []
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(points[i + 1].x - points[i].x)
    d.push(h[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / h[i])
  }
  const m: number[] = new Array(n)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  let path = `M${r1(points[0].x)} ${r1(points[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    const third = h[i] / 3
    path += ` C${r1(p.x + third)} ${r1(p.y + m[i] * third)} ${r1(q.x - third)} ${r1(q.y - m[i + 1] * third)} ${r1(q.x)} ${r1(q.y)}`
  }
  return path
}

/**
 * Lays monthly values out in a width x height box. Each point sits at the
 * centre of its own equal-width column, so the month labels underneath (a
 * CSS grid of the same number of columns) line up with the points at any
 * width. The value range always includes zero so the dashed baseline is on
 * screen; `padTop` leaves room for the callout.
 */
export function savingsChartGeometry(
  values: number[],
  width: number,
  height: number,
  { padTop = 12, padBottom = 12 }: { padTop?: number; padBottom?: number } = {}
): SavingsChartGeometry {
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const usable = Math.max(1, height - padTop - padBottom)
  const yOf = (v: number) => padTop + (1 - (v - min) / span) * usable
  const zeroY = r1(yOf(0))
  const n = values.length
  const points = values.map((value, i) => ({
    x: r1(((i + 0.5) / n) * width),
    y: r1(yOf(value)),
    value,
  }))
  const line = smoothPath(points)
  const area =
    points.length > 1
      ? `${line} L${points[points.length - 1].x} ${zeroY} L${points[0].x} ${zeroY} Z`
      : ''
  return { points, zeroY, line, area }
}
