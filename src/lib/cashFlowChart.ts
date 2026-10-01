/**
 * Layout for Review's "Money in and out" chart: money in rises above a
 * shared baseline, money out hangs below it, and a "kept" line joins each
 * month's in − out on the same scale. All positions are fractions of the
 * chart's height, measured from the top (0) to the bottom (1), so the
 * component can turn them straight into CSS percentages.
 */
export interface CashFlowMonth {
  month: string
  income: number
  spent: number
}

export interface CashFlowColumn extends CashFlowMonth {
  /** Height of the money-in bar (from the baseline up). */
  inHeight: number
  /** Height of the money-out bar (from the baseline down). */
  outHeight: number
  /** Where the kept point sits (in − out), clamped to the chart. */
  keptY: number
  /** Nothing logged that month -- drawn as a faint stub, left off the line. */
  empty: boolean
}

export interface CashFlowLayout {
  baseline: number
  columns: CashFlowColumn[]
  /** Runs of neighbouring months with data, joined by the kept line. */
  segments: number[][]
}

export function cashFlowLayout(months: CashFlowMonth[]): CashFlowLayout {
  const maxIn = Math.max(0, ...months.map((m) => m.income))
  const maxOut = Math.max(0, ...months.map((m) => m.spent))
  const span = maxIn + maxOut
  const baseline = span > 0 ? maxIn / span : 0.5
  const clamp = (v: number) => Math.min(1, Math.max(0, v))

  const columns = months.map((m) => ({
    ...m,
    inHeight: span > 0 ? m.income / span : 0,
    outHeight: span > 0 ? m.spent / span : 0,
    keptY: span > 0 ? clamp(baseline - (m.income - m.spent) / span) : baseline,
    empty: m.income === 0 && m.spent === 0,
  }))

  const segments: number[][] = []
  let run: number[] = []
  columns.forEach((c, i) => {
    if (c.empty) {
      if (run.length) segments.push(run)
      run = []
    } else run.push(i)
  })
  if (run.length) segments.push(run)

  return { baseline, columns, segments }
}
