import type { TransactionType } from '@/types/database.types'
import { addDaysISO } from '@/lib/billCalendar'

/** The minimum a row needs for the list's day totals. */
interface DayRow {
  date: string
  type: TransactionType
  amount: number
}

/**
 * Net total per calendar day for the rows passed in (whatever is loaded, not
 * the whole history): income counts positive, expenses negative, transfers
 * are left out since they only move money between your own accounts. A day
 * with nothing but transfers gets no entry, so its heading shows no total.
 */
export function dayNetTotals(rows: DayRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (r.type === 'transfer') continue
    const signed = r.type === 'income' ? r.amount : -r.amount
    totals.set(r.date, (totals.get(r.date) ?? 0) + signed)
  }
  // Round away float noise (0.1 + 0.2) so a balanced day reads as exactly 0.
  for (const [date, total] of totals) totals.set(date, Math.round(total * 100) / 100)
  return totals
}

export interface DayGroup<T> {
  /** ISO calendar date (YYYY-MM-DD) shared by every row in the group. */
  date: string
  rows: T[]
  /** Income minus expenses for the group's rows; null when it only has transfers. */
  net: number | null
}

/**
 * Splits a loaded list into one group per calendar day, in the order each day
 * first appears (the list comes back newest first). Rows of a day that arrive
 * later -- the next "Load more" page continuing the same day -- join that
 * day's existing group instead of starting a second heading for it.
 */
export function groupByDay<T extends DayRow>(rows: T[]): DayGroup<T>[] {
  const byDate = new Map<string, T[]>()
  for (const r of rows) {
    const list = byDate.get(r.date)
    if (list) list.push(r)
    else byDate.set(r.date, [r])
  }
  const nets = dayNetTotals(rows)
  return Array.from(byDate, ([date, dayRows]) => ({ date, rows: dayRows, net: nets.get(date) ?? null }))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The day heading over a group: "Today · Sun 27 Sep", "Yesterday · Sat 26 Sep",
 * otherwise just "Fri 25 Sep" -- with the year added once it's not this year's.
 * `today` is the local calendar date (pass `todayISO()`), never a UTC one.
 */
export function dayHeadingLabel(iso: string, today: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  // Local-time constructor on purpose: only the weekday is read back, and the
  // date parts came from the string itself, so no UTC shift can creep in.
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  const sameYear = today.slice(0, 4) === iso.slice(0, 4)
  const date = `${weekday} ${d} ${MONTHS[m - 1]}${sameYear ? '' : ` ${y}`}`
  if (iso === today) return `Today · ${date}`
  if (iso === addDaysISO(today, -1)) return `Yesterday · ${date}`
  return date
}

/** First letter or digit of a merchant name, upper-cased, for the row avatar. */
export function merchantInitial(merchant: string | null | undefined): string {
  const match = (merchant ?? '').match(/[\p{L}\p{N}]/u)
  return match ? match[0].toLocaleUpperCase() : '?'
}

export type AvatarTone = 'positive' | 'neutral' | 'accent' | 'info' | 'caution'

/** Tones an expense category can land on -- `positive` is kept for income so
 *  green always means money in, and red is never used for a category. */
const CATEGORY_TONES: AvatarTone[] = ['accent', 'info', 'caution', 'neutral']

/**
 * A stable tint for a row's merchant avatar: income is always `positive`,
 * transfers `neutral`, and each expense category hashes to the same tone every
 * time (so all "Groceries" rows match) without keeping a category → color table.
 */
export function avatarTone(category: string | null | undefined, type: TransactionType): AvatarTone {
  if (type === 'income') return 'positive'
  if (type === 'transfer') return 'neutral'
  const key = (category ?? '').trim().toLowerCase()
  if (!key) return 'neutral'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return CATEGORY_TONES[hash % CATEGORY_TONES.length]
}

/** Quick filter chips under the search box; each maps to `filters.type`. */
export const QUICK_TYPE_CHIPS: { label: string; type: TransactionType | null }[] = [
  { label: 'All', type: null },
  { label: 'Money out', type: 'expense' },
  { label: 'Money in', type: 'income' },
  { label: 'Transfers', type: 'transfer' },
]

/** Width in px of each swipe action button (Edit / Split / Delete). */
export const SWIPE_ACTION_WIDTH = 76

/**
 * Where a row sits while being dragged: `start` is the offset when the drag
 * began (0 closed, -actionsWidth open), `dx` the pointer movement since. Can't
 * be dragged right past closed; past fully open it resists (moves at 1/4 speed).
 */
export function dragOffset(start: number, dx: number, actionsWidth: number): number {
  const raw = start + dx
  if (raw > 0) return 0
  if (raw < -actionsWidth) return -actionsWidth + (raw + actionsWidth) / 4
  return raw
}

/**
 * Where a released row settles: fully open or fully closed. A quick flick
 * (|velocity| in px/ms above 0.4) wins in its direction; otherwise the row
 * opens once it's past a third of the actions' width.
 */
export function snapOffset(offset: number, actionsWidth: number, velocity = 0): number {
  if (actionsWidth <= 0) return 0
  if (velocity < -0.4) return -actionsWidth
  if (velocity > 0.4) return 0
  return offset <= -actionsWidth / 3 ? -actionsWidth : 0
}
