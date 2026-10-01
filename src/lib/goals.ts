import { shiftMonth } from '@/lib/savings'
// Pure goal math for the Goals page (progress ring, "Saved so far" summary,
// the monthly pace line and "Add money"). Dates are plain local calendar
// strings (YYYY-MM-DD, from todayISO()/toLocalISODate()); day counts are done
// on Date.UTC of those parts, so no local/UTC conversion ever shifts a day.

export interface GoalAmounts {
  current_amount: number
  target_amount: number
}

export interface GoalForPace extends GoalAmounts {
  due_date: string | null
  /** Local YYYY-MM-DD the goal was created (toLocalISODate(new Date(created_at))). */
  start_date?: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 0-100, clamped. A goal with no positive target counts as 0%. */
export function goalPercent(goal: GoalAmounts): number {
  if (!(goal.target_amount > 0)) return 0
  return Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100))
}

export function isGoalReached(goal: GoalAmounts): boolean {
  return goal.target_amount > 0 && goal.current_amount >= goal.target_amount
}

export interface GoalsSummary {
  saved: number
  target: number
  count: number
  reached: number
}

export function summarizeGoals(goals: readonly GoalAmounts[]): GoalsSummary {
  let saved = 0
  let target = 0
  let reached = 0
  for (const g of goals) {
    saved += Number(g.current_amount) || 0
    target += Number(g.target_amount) || 0
    if (isGoalReached(g)) reached++
  }
  return { saved: round2(saved), target: round2(target), count: goals.length, reached }
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

function dayNumber(iso: string): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/**
 * Months left from `today` to `due`, rounded up (a partial month counts as a
 * month you can still save in), never less than 1. Same day next month = 1.
 */
export function monthsUntil(today: string, due: string): number {
  const [y1, m1, d1] = parts(today)
  const [y2, m2, d2] = parts(due)
  let months = (y2 - y1) * 12 + (m2 - m1)
  if (d2 > d1) months += 1
  return Math.max(1, months)
}

export type GoalPace =
  | { kind: 'reached' }
  | { kind: 'no-date'; remaining: number }
  | { kind: 'overdue'; remaining: number }
  | { kind: 'scheduled'; remaining: number; monthly: number; months: number; onTrack: boolean }

/**
 * How the goal is pacing. With a due date: the monthly amount still needed to
 * reach it, and whether saved-so-far is at least where a straight line from
 * the goal's start date to its due date says it should be today. Without a
 * start date (or one on/after the due date) only the calendar decides:
 * before the due date counts as on track.
 */
export function goalPace(goal: GoalForPace, today: string): GoalPace {
  if (isGoalReached(goal)) return { kind: 'reached' }
  const remaining = round2(Math.max(0, goal.target_amount - goal.current_amount))
  if (!goal.due_date) return { kind: 'no-date', remaining }

  const now = dayNumber(today)
  const due = dayNumber(goal.due_date)
  if (due < now) return { kind: 'overdue', remaining }

  const months = monthsUntil(today, goal.due_date)
  const monthly = round2(remaining / months)

  let onTrack = true
  if (goal.start_date) {
    const start = dayNumber(goal.start_date)
    const span = due - start
    if (span > 0) {
      const elapsed = Math.min(span, Math.max(0, now - start))
      const expected = (elapsed / span) * goal.target_amount
      // A rupee of rounding shouldn't flip the label to "behind".
      onTrack = goal.current_amount + 0.005 >= expected
    }
  }
  return { kind: 'scheduled', remaining, monthly, months, onTrack }
}

/** Adds a deposit to a goal's saved amount, rounded to paise/cents. */
export function addToGoal(current: number, amount: number): number {
  return round2(current + amount)
}

/**
 * Parses the "Add money" field: a positive finite number, else null.
 * Accepts commas as thousands separators ("1,500").
 */
export function parseDeposit(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return round2(n)
}

// ---- "Goal reached" celebration: plays once per goal per browser ----------

const CELEBRATED_KEY = 'ledgeeaze:goals-celebrated'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readCelebratedGoals(storage: StorageLike | null = defaultStorage()): Set<string> {
  try {
    const raw = storage?.getItem(CELEBRATED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markGoalCelebrated(id: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    const ids = readCelebratedGoals(storage)
    if (ids.has(id)) return
    ids.add(id)
    storage?.setItem(CELEBRATED_KEY, JSON.stringify([...ids]))
  } catch {
    // Private window / blocked storage: the badge just pops again next time.
  }
}

/** A recurring payment that feeds a goal (a SIP, RD, savings transfer). */
export interface GoalFeeder {
  amount: number
  cadence: string
  next_date: string
}

const PER_MONTH: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  'half-yearly': 1 / 6,
  annual: 1 / 12,
}

/**
 * When the linked SIPs reach the goal at their current pace: the monthly
 * total they put in, and the month (YYYY-MM) the goal is reached, counting
 * from the earliest next payment. Null when nothing feeds it or it's reached.
 */
export function feederProjection(remaining: number, feeders: readonly GoalFeeder[]): { monthly: number; reachMonth: string } | null {
  if (remaining <= 0 || feeders.length === 0) return null
  const monthly = Math.round(feeders.reduce((sum, f) => sum + f.amount * (PER_MONTH[f.cadence] ?? 1), 0) * 100) / 100
  if (monthly <= 0) return null
  const first = feeders.map((f) => f.next_date.slice(0, 7)).sort()[0]
  const months = Math.ceil(remaining / monthly)
  return { monthly, reachMonth: shiftMonth(first, months - 1) }
}
