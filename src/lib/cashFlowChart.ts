/**
 * Review's "Money in and out" month strip: one bar per month for what you
 * kept (money in − money out). Kept rises above a centre line in green, a
 * month where more went out than came in hangs below it in red. Heights are
 * fractions of the strip's height; the line sits where the tallest kept and
 * the deepest overspend meet, so both get room in proportion.
 */
export interface CashFlowMonth {
  month: string
  income: number
  spent: number
}

export interface KeptBar extends CashFlowMonth {
  kept: number
  /** Height as a fraction of the strip (0..1). */
  height: number
  /** Nothing logged that month -- drawn as a faint dot. */
  empty: boolean
}

export interface KeptStrip {
  /** Where the centre line sits, from the top (0..1). */
  baseline: number
  bars: KeptBar[]
}

export function keptStrip(months: CashFlowMonth[]): KeptStrip {
  const kept = months.map((m) => Math.round((m.income - m.spent) * 100) / 100)
  const up = Math.max(0, ...kept)
  const down = Math.max(0, ...kept.map((k) => -k))
  const span = up + down
  // Only gains: the line sits at the bottom; only losses: at the top.
  const baseline = span > 0 ? up / span : 1
  return {
    baseline,
    bars: months.map((m, i) => ({
      ...m,
      kept: kept[i],
      height: span > 0 ? Math.abs(kept[i]) / span : 0,
      empty: m.income === 0 && m.spent === 0,
    })),
  }
}

/** In and out bar widths for one month, relative to the larger of the two. */
export function inOutWidths(income: number, spent: number): { income: number; spent: number } {
  const max = Math.max(income, spent)
  if (max <= 0) return { income: 0, spent: 0 }
  return { income: income / max, spent: spent / max }
}
