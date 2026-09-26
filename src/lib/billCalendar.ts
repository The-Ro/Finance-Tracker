import { nextDateForCadence } from '@/lib/recurringDetection'
import type { Cadence } from '@/types/database.types'

export interface SchedulableItem {
  next_date: string
  cadence: Cadence
  active: boolean
  amount: number
}

/** ISO date `days` after `iso`, computed entirely in UTC space (no local/UTC mismatch). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Projected due dates of one item within [start, end] (inclusive ISO dates).
 * Projection starts at next_date and steps forward by cadence -- nothing
 * before next_date is projected (earlier dates were paid, or are overdue and
 * shown separately). Nothing here moves next_date; only "mark paid" does.
 */
export function dueDatesInRange(item: SchedulableItem, start: string, end: string): string[] {
  if (!item.active) return []
  const out: string[] = []
  let date = item.next_date
  for (let guard = 0; date <= end && guard < 400; guard++) {
    if (date >= start) out.push(date)
    date = nextDateForCadence(date, item.cadence)
  }
  return out
}

/**
 * Total owed from `today` through the next `days` days, counting every
 * projected occurrence, plus anything already overdue (next_date < today) once.
 */
export function totalDueWithin(items: SchedulableItem[], today: string, days: number): number {
  const end = addDaysISO(today, days - 1)
  let total = 0
  for (const item of items) {
    if (!item.active) continue
    if (item.next_date < today) total += item.amount
    total += dueDatesInRange(item, today, end).length * item.amount
  }
  return total
}

/** A Monday-first month grid: blank leading cells, then each day's ISO date. */
export function monthGrid(year: number, monthIndex: number): { leading: number; days: string[] } {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const leading = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const mm = String(monthIndex + 1).padStart(2, '0')
  const days = Array.from({ length: count }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`)
  return { leading, days }
}
