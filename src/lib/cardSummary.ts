// Home's "Owed on cards" tile and Credit cards list: totals across cards and
// the colour a card's utilization bar takes.

export type UtilizationTone = 'positive' | 'caution' | 'danger'

/** Green below 30% of the limit, amber from 30% to 70%, red above 70%. */
export function utilizationTone(percent: number): UtilizationTone {
  if (percent > 70) return 'danger'
  if (percent >= 30) return 'caution'
  return 'positive'
}

export interface CardLimitTotals {
  /** Sum of the limits of cards that have one. */
  limit: number
  /** Owed on those same cards (cards without a limit aren't counted, so the share can't exceed what's knowable). */
  owedOnLimited: number
  /** Share of the combined limit in use, 0-100; null when no card has a limit. */
  percent: number | null
}

/** Combined limit and utilization across cards (pass open cards only). */
export function cardLimitTotals(cards: { owed: number; limit: number | null }[]): CardLimitTotals {
  let limit = 0
  let owedOnLimited = 0
  for (const c of cards) {
    if (c.limit == null || c.limit <= 0) continue
    limit += c.limit
    owedOnLimited += c.owed
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    limit: r(limit),
    owedOnLimited: r(owedOnLimited),
    percent: limit > 0 ? Math.min(100, (owedOnLimited / limit) * 100) : null,
  }
}
