import type { SelectedPeriod } from '@/types/database.types'
import { toLocalISODate } from '@/lib/format'

export interface DateRange {
  /** Inclusive ISO date (YYYY-MM-DD), or null for "no lower bound" (All time). */
  start: string | null
  /** Inclusive ISO date (YYYY-MM-DD). */
  end: string
}

export const PERIOD_OPTIONS: { value: SelectedPeriod; label: string }[] = [
  { value: 'all-time', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'last-6-months', label: 'Last 6 months' },
  { value: 'this-year', label: 'This year' },
]

// Was `d.toISOString().slice(0, 10)` -- converts to UTC first, which shifts
// every period boundary by a day for anyone not in UTC+0 (see the note on
// toLocalISODate in @/lib/format). Every range below is built from this.
const toISODate = toLocalISODate

/** Resolves a selected period into an actual date range, anchored to "now". */
export function resolvePeriod(period: SelectedPeriod, now: Date = new Date()): DateRange {
  const end = toISODate(now)

  switch (period) {
    case 'all-time':
      return { start: null, end }
    case 'today':
      return { start: end, end }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: toISODate(start), end }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: toISODate(start), end: toISODate(lastDay) }
    }
    case 'last-3-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { start: toISODate(start), end }
    }
    case 'last-6-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { start: toISODate(start), end }
    }
    case 'this-year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { start: toISODate(start), end }
    }
  }
}

/** Today's day-of-month `monthsBack` months ago, clamped to that month's length. */
function sameDayMonthsBack(now: Date, monthsBack: number): Date {
  const lastDay = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth() - monthsBack, Math.min(now.getDate(), lastDay))
}

/**
 * The immediately-preceding period of equal length, used only for "vs last period"
 * comparisons. Periods that run up to today are partial, so their prior period
 * stops at the same point too (on Mar 3, "this month" is compared with Feb 1-3,
 * not all of February). Returns null when there's no well-defined prior period
 * (All time).
 */
export function resolvePriorPeriod(period: SelectedPeriod, now: Date = new Date()): DateRange | null {
  switch (period) {
    case 'all-time':
      return null
    case 'today': {
      const yesterday = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
      return { start: yesterday, end: yesterday }
    }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: toISODate(start), end: toISODate(sameDayMonthsBack(now, 1)) }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - 1, 0)
      return { start: toISODate(start), end: toISODate(end) }
    }
    case 'last-3-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { start: toISODate(start), end: toISODate(sameDayMonthsBack(now, 3)) }
    }
    case 'last-6-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      return { start: toISODate(start), end: toISODate(sameDayMonthsBack(now, 6)) }
    }
    case 'this-year': {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      return { start: toISODate(start), end: toISODate(sameDayMonthsBack(now, 12)) }
    }
  }
}

export function isWithinRange(date: string, range: DateRange): boolean {
  if (range.start && date < range.start) return false
  if (date > range.end) return false
  return true
}
