import { nthDateForCadence } from '@/lib/recurringDetection'
import type { Cadence } from '@/types/database.types'

export interface SchedulableItem {
  next_date: string
  cadence: Cadence
  active: boolean
  amount: number
  /** Day of month the bill is really due on (recurring_items.anchor_day); next_date may be clamped below it. */
  anchor_day?: number | null
}

/** The anchor day, if it's consistent with next_date (i.e. next_date is that day, clamped to its month). */
function anchorDayFor(item: SchedulableItem): number | undefined {
  if (!item.anchor_day) return undefined
  const [y, m, d] = item.next_date.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Math.min(item.anchor_day, daysInMonth) === d ? item.anchor_day : undefined
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
 * Projection is anchored on next_date (each occurrence is k cadence steps from
 * it, so a 31st stays the 31st after a short month) -- nothing before
 * next_date is projected (earlier dates were paid, or are overdue and shown
 * separately). Nothing here moves next_date; only "mark paid" does.
 */
export function dueDatesInRange(item: SchedulableItem, start: string, end: string): string[] {
  if (!item.active) return []
  const out: string[] = []
  const day = anchorDayFor(item)
  for (let k = 0; k < 400; k++) {
    const date = nthDateForCadence(item.next_date, item.cadence, k, day)
    if (date > end) break
    if (date >= start) out.push(date)
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
