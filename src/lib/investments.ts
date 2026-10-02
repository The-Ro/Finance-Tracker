import { normalizeMerchant } from './merchant'
import { nthDateForCadence } from './recurringDetection'
import type { Cadence } from '@/types/database.types'

/**
 * Investments = money you put in (SIPs, RDs, PPF, NPS, one-off buys). An
 * entry counts when it's tagged #invest (Mark paid on an investment adds the
 * tag), its category is "Investments", or it was logged under the name of a
 * recurring payment marked as an investment (covers payments logged before
 * the tag existed). This is what you put in -- never what it's worth today.
 */
export const INVEST_TAG = 'invest'
export const INVEST_CATEGORY = 'Investments'

/** Names that are almost always an investment -- used to tick the box by default. */
const INVESTMENT_WORDS =
  /\b(sip|sips|mutual funds?|mf|elss|index funds?|rd|recurring deposit|ppf|nps|sukanya|ssy|etfs?|sgb|gold bond|fixed deposit|fd|stocks?|shares|smallcase|groww|zerodha|kuvera|paytm money|invest(ment|ments|ing)?)\b/i

export function looksLikeInvestment(name: string): boolean {
  return INVESTMENT_WORDS.test(name)
}

export interface InvestEntry {
  date: string
  amount: number
  type: string
  merchant: string
  category: string | null
  tags: string[] | null
}

export interface InvestItem {
  id: string
  name: string
  amount: number
  cadence: Cadence
  next_date: string
  active: boolean
  is_investment: boolean
  goal_id: string | null
  /** First of the month it started (SIPs before the app count from here). */
  started_on?: string | null
  /** Due dates the user marked as missed. */
  missed_dates?: string[] | null
  anchor_day?: number | null
}

/**
 * Every due date of an investment from the month it started up to (not
 * including) its next_date -- the ones already behind it, the same way
 * loanProgress counts EMIs: Mark paid is what moves next_date on. Oldest first.
 */
export function pastDueDates(item: Pick<InvestItem, 'next_date' | 'cadence' | 'started_on' | 'anchor_day'>): string[] {
  if (!item.started_on) return []
  const start = item.started_on.slice(0, 7) + '-01'
  const day = item.anchor_day ?? undefined
  const out: string[] = []
  for (let k = 1; k < 2000; k++) {
    const d = nthDateForCadence(item.next_date, item.cadence, -k, day)
    if (d < start) break
    out.push(d)
  }
  return out.reverse()
}

export interface InvestmentHistory {
  /** All due dates behind next_date, oldest first. */
  dues: string[]
  missed: Set<string>
  paid: number
  putIn: number
}

/** What a started investment has had put in: every past due date that wasn't marked missed. */
export function investmentHistory(item: InvestItem): InvestmentHistory | null {
  if (!item.started_on) return null
  const dues = pastDueDates(item)
  const missed = new Set((item.missed_dates ?? []).filter((d) => dues.includes(d)))
  const paid = dues.length - missed.size
  return { dues, missed, paid, putIn: Math.round(paid * Number(item.amount) * 100) / 100 }
}

/** How many payments and how much a start month would count -- the add form's preview. */
export function startPreview(item: Pick<InvestItem, 'next_date' | 'cadence' | 'anchor_day' | 'amount'>, startMonth: string) {
  const dues = pastDueDates({ ...item, started_on: startMonth + '-01' })
  return { payments: dues.length, total: Math.round(dues.length * Number(item.amount) * 100) / 100 }
}

const PER_MONTH: Record<Cadence, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  'half-yearly': 1 / 6,
  annual: 1 / 12,
}

/** What an item adds up to in an average month. */
export function monthlyAmount(amount: number, cadence: Cadence): number {
  return amount * PER_MONTH[cadence]
}

export function isInvestmentEntry(e: InvestEntry, itemNames: Set<string>): boolean {
  if (e.type !== 'expense') return false
  if (e.tags?.includes(INVEST_TAG)) return true
  if (e.category === INVEST_CATEGORY) return true
  return itemNames.has(normalizeMerchant(e.merchant))
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split('-').map(Number)
  const idx = y * 12 + (m - 1) + by
  const year = Math.floor(idx / 12)
  return `${year}-${String(idx - year * 12 + 1).padStart(2, '0')}`
}

export interface InvestmentItemSummary {
  id: string
  name: string
  amount: number
  cadence: Cadence
  next_date: string
  goal_id: string | null
  /** Everything logged under this investment so far. */
  putIn: number
  payments: number
  lastPaid: string | null
}

export interface InvestmentSummary {
  total: number
  thisYear: number
  thisMonth: number
  /** Active investments, as a monthly amount. */
  monthlyPlan: number
  /** Last 12 months, oldest first. */
  byMonth: { month: string; amount: number }[]
  /** Months in a row with something invested, counting back from this month (or last month, if this one has nothing yet). */
  streak: number
  /** Share of money in that went into investments over the last 3 full months, or null with no income. */
  incomeShare: number | null
  items: InvestmentItemSummary[]
  /** Tagged / categorised entries not tied to a recurring investment (one-off buys). */
  oneOff: number
  first: string | null
}

export function investmentSummary(
  entries: (InvestEntry & { type: string })[],
  items: InvestItem[],
  today: string
): InvestmentSummary {
  const investItems = items.filter((i) => i.is_investment)
  const byName = new Map(investItems.map((i) => [normalizeMerchant(i.name), i]))
  const names = new Set(byName.keys())
  // Started items count from their start month (history); their logged entries
  // would count the same payments twice, so they're skipped below.
  const histories = new Map(investItems.map((i) => [i.id, investmentHistory(i)]))

  const thisMonth = monthKey(today)
  const year = today.slice(0, 4)
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth, i - 11))
  const perMonth = new Map<string, number>()
  const perItem = new Map<string, { putIn: number; payments: number; lastPaid: string | null }>()
  let total = 0
  let thisYearTotal = 0
  let oneOff = 0
  let first: string | null = null
  const incomeMonths = new Map<string, number>()

  for (const e of entries) {
    if (e.type === 'income') {
      incomeMonths.set(monthKey(e.date), (incomeMonths.get(monthKey(e.date)) ?? 0) + Number(e.amount))
      continue
    }
    if (!isInvestmentEntry(e, names)) continue
    const owner = byName.get(normalizeMerchant(e.merchant))
    if (owner && histories.get(owner.id)) continue
    const amt = Number(e.amount)
    total += amt
    if (e.date.startsWith(year)) thisYearTotal += amt
    perMonth.set(monthKey(e.date), (perMonth.get(monthKey(e.date)) ?? 0) + amt)
    if (!first || e.date < first) first = e.date
    const item = byName.get(normalizeMerchant(e.merchant))
    if (item) {
      const s = perItem.get(item.id) ?? { putIn: 0, payments: 0, lastPaid: null }
      s.putIn += amt
      s.payments += 1
      if (!s.lastPaid || e.date > s.lastPaid) s.lastPaid = e.date
      perItem.set(item.id, s)
    } else oneOff += amt
  }

  for (const i of investItems) {
    const h = histories.get(i.id)
    if (!h) continue
    const amt = Number(i.amount)
    for (const d of h.dues) {
      if (h.missed.has(d)) continue
      total += amt
      if (d.startsWith(year)) thisYearTotal += amt
      perMonth.set(monthKey(d), (perMonth.get(monthKey(d)) ?? 0) + amt)
      if (!first || d < first) first = d
    }
    perItem.set(i.id, { putIn: h.putIn, payments: h.paid, lastPaid: [...h.dues].reverse().find((d) => !h.missed.has(d)) ?? null })
  }

  let streak = 0
  let cursor = (perMonth.get(thisMonth) ?? 0) > 0 ? thisMonth : shiftMonth(thisMonth, -1)
  while ((perMonth.get(cursor) ?? 0) > 0) {
    streak += 1
    cursor = shiftMonth(cursor, -1)
  }

  const last3 = [1, 2, 3].map((n) => shiftMonth(thisMonth, -n))
  const income3 = last3.reduce((s, m) => s + (incomeMonths.get(m) ?? 0), 0)
  const invested3 = last3.reduce((s, m) => s + (perMonth.get(m) ?? 0), 0)

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    total: round(total),
    thisYear: round(thisYearTotal),
    thisMonth: round(perMonth.get(thisMonth) ?? 0),
    monthlyPlan: round(investItems.filter((i) => i.active).reduce((s, i) => s + monthlyAmount(Number(i.amount), i.cadence), 0)),
    byMonth: months.map((m) => ({ month: m, amount: round(perMonth.get(m) ?? 0) })),
    streak,
    incomeShare: income3 > 0 ? invested3 / income3 : null,
    items: investItems
      .map((i) => {
        const s = perItem.get(i.id)
        return {
          id: i.id,
          name: i.name,
          amount: Number(i.amount),
          cadence: i.cadence,
          next_date: i.next_date,
          goal_id: i.goal_id,
          putIn: round(s?.putIn ?? 0),
          payments: s?.payments ?? 0,
          lastPaid: s?.lastPaid ?? null,
        }
      })
      .sort((a, b) => b.putIn - a.putIn || a.name.localeCompare(b.name)),
    oneOff: round(oneOff),
    first,
  }
}

/** Money put into investments between two dates (inclusive) -- e.g. Review's "of this, ₹X went into investments". */
export function investedBetween(entries: InvestEntry[], items: InvestItem[], range: { start: string; end: string }): number {
  const names = new Set(items.filter((i) => i.is_investment).map((i) => normalizeMerchant(i.name)))
  const sum = entries
    .filter((e) => e.date >= range.start && e.date <= range.end && isInvestmentEntry(e, names))
    .reduce((s, e) => s + Number(e.amount), 0)
  return Math.round(sum * 100) / 100
}

export type MonthCellState = 'paid' | 'missed' | 'due' | 'none'

export interface MonthCell {
  /** YYYY-MM */
  month: string
  state: MonthCellState
  /** The due dates in this month (what a tap marks missed or paid). */
  dues: string[]
}

/**
 * The detail page's month grid: one row per year from the start year to this
 * year, 12 cells each. A month with a past due date is paid (or missed if
 * every due date in it was marked missed); next_date's month is "due" when
 * it's this month or earlier; everything else is blank.
 */
export function investmentMonthGrid(item: InvestItem, today: string): { year: number; cells: MonthCell[] }[] {
  const h = investmentHistory(item)
  if (!h) return []
  const byMonth = new Map<string, string[]>()
  for (const d of h.dues) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), d])
  const startYear = Number(item.started_on!.slice(0, 4))
  const endYear = Math.max(Number(today.slice(0, 4)), startYear)
  const dueMonth = item.next_date <= today || item.next_date.slice(0, 7) === today.slice(0, 7) ? item.next_date.slice(0, 7) : null
  const rows = []
  for (let y = startYear; y <= endYear; y++) {
    const cells: MonthCell[] = []
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2, '0')}`
      const dues = byMonth.get(month) ?? []
      let state: MonthCellState = 'none'
      if (dues.length) state = dues.every((d) => h.missed.has(d)) ? 'missed' : 'paid'
      else if (month === dueMonth) state = 'due'
      cells.push({ month, state, dues })
    }
    rows.push({ year: y, cells })
  }
  return rows
}

/** missed_dates after a tap on a month: all its due dates flip together. */
export function toggleMissedMonth(missed: string[] | null | undefined, cell: MonthCell): string[] {
  const set = new Set(missed ?? [])
  const nowMissed = cell.state !== 'missed'
  for (const d of cell.dues) {
    if (nowMissed) set.add(d)
    else set.delete(d)
  }
  return [...set].sort()
}

/** "Mar 2024" from an ISO date or YYYY-MM. */
export function monthYearLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
