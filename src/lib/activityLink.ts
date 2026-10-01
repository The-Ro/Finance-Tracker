import type { DateRange } from '@/lib/period'

/**
 * A link to Activity showing one category's entries over a date span
 * (`/transactions?category=Bike&since=2026-09-30&until=2026-10-01`). Used by
 * budget cards and Review's budget lines; TransactionsPage reads the params.
 */
export function activityLink(category: string, range: DateRange): string {
  const q = new URLSearchParams({ category })
  if (range.start) q.set('since', range.start)
  q.set('until', range.end)
  return `/transactions?${q.toString()}`
}

/** The span from `since`/`until` params, when both are valid YYYY-MM-DD dates (since may be absent). */
export function rangeFromParams(params: URLSearchParams): DateRange | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/
  const since = params.get('since')
  const until = params.get('until')
  if (!until || !iso.test(until) || (since && !iso.test(since))) return null
  if (since && since > until) return null
  return { start: since, end: until }
}
