// Lent & borrowed: who owes what, worked out from the records and their
// repayments. Pure, so it's unit-tested (ious.test.ts).

import type { IouDirection } from '@/types/database.types'

export interface IouRecord {
  id: string
  person: string
  direction: IouDirection
  amount: number
  date: string
  due_date: string | null
  note: string | null
}

export interface IouPayment {
  iou_id: string
  amount: number
  date: string
}

export interface IouLine extends IouRecord {
  paid: number
  left: number
  settled: boolean
  /** Not settled and past its due date. */
  overdue: boolean
  /** Date of the last repayment, if any. */
  lastPaid: string | null
}

export interface IouPerson {
  /** As first typed (people are grouped ignoring case and extra spaces). */
  person: string
  /** Positive: they owe you. Negative: you owe them. */
  net: number
  open: IouLine[]
  settled: IouLine[]
}

export interface IouSummary {
  /** Everything people still owe you (sum of open "lent" amounts left). */
  owedToYou: number
  /** Everything you still owe (sum of open "borrowed" amounts left). */
  youOwe: number
  /** People with something open first (biggest first), then settled-only people. */
  people: IouPerson[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
export const personKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

export function iouLine(record: IouRecord, payments: readonly IouPayment[], today: string): IouLine {
  let paid = 0
  let lastPaid: string | null = null
  for (const p of payments) {
    if (p.iou_id !== record.id) continue
    paid += p.amount
    if (!lastPaid || p.date > lastPaid) lastPaid = p.date
  }
  paid = round2(paid)
  const left = round2(Math.max(0, record.amount - paid))
  const settled = left === 0
  return { ...record, paid, left, settled, overdue: !settled && !!record.due_date && record.due_date < today, lastPaid }
}

export function summarizeIous(records: readonly IouRecord[], payments: readonly IouPayment[], today: string): IouSummary {
  const people = new Map<string, IouPerson>()
  let owedToYou = 0
  let youOwe = 0
  // Oldest first, so the name as first typed wins and lists read in date order.
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  for (const record of sorted) {
    const line = iouLine(record, payments, today)
    const key = personKey(record.person)
    const entry = people.get(key) ?? { person: record.person.trim().replace(/\s+/g, ' '), net: 0, open: [], settled: [] }
    if (line.settled) entry.settled.push(line)
    else {
      entry.open.push(line)
      if (line.direction === 'lent') {
        entry.net += line.left
        owedToYou += line.left
      } else {
        entry.net -= line.left
        youOwe += line.left
      }
    }
    people.set(key, entry)
  }
  const list = [...people.values()].map((p) => ({ ...p, net: round2(p.net), settled: p.settled.reverse() }))
  list.sort((a, b) => {
    const aOpen = a.open.length > 0 ? 1 : 0
    const bOpen = b.open.length > 0 ? 1 : 0
    return bOpen - aOpen || Math.abs(b.net) - Math.abs(a.net) || a.person.localeCompare(b.person)
  })
  return { owedToYou: round2(owedToYou), youOwe: round2(youOwe), people: list }
}

/** A friendly nudge for the share sheet (only for money you lent). */
export function reminderText(person: string, left: number, lines: readonly IouLine[], format: (n: number) => string): string {
  const first = person.trim().split(/\s+/)[0] || person
  const since = lines.length === 1 ? ` from ${lines[0].date.split('-').reverse().slice(0, 2).join('/')}` : ''
  return `Hi ${first}, just a gentle reminder about the ${format(left)}${since} I lent you. Thanks!`
}
