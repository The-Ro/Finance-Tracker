import { describe, expect, it } from 'vitest'
import { iouLine, reminderText, summarizeIous, type IouRecord } from './ious'

const rec = (over: Partial<IouRecord> & Pick<IouRecord, 'id'>): IouRecord => ({
  person: 'Ravi',
  direction: 'lent',
  amount: 1000,
  date: '2026-09-01',
  due_date: null,
  note: null,
  ...over,
})

describe('iouLine', () => {
  it('adds up repayments and knows when it is settled or overdue', () => {
    const r = rec({ id: 'a', due_date: '2026-09-20' })
    const part = iouLine(r, [{ iou_id: 'a', amount: 400, date: '2026-09-10' }, { iou_id: 'x', amount: 999, date: '2026-09-11' }], '2026-09-29')
    expect(part).toMatchObject({ paid: 400, left: 600, settled: false, overdue: true, lastPaid: '2026-09-10' })
    const done = iouLine(r, [{ iou_id: 'a', amount: 1000, date: '2026-09-25' }], '2026-09-29')
    expect(done).toMatchObject({ left: 0, settled: true, overdue: false })
  })
})

describe('summarizeIous', () => {
  const records = [
    rec({ id: 'a', person: 'Ravi', amount: 5000, date: '2026-09-01' }),
    rec({ id: 'b', person: ' ravi  ', amount: 1000, date: '2026-09-05', direction: 'borrowed' }),
    rec({ id: 'c', person: 'Priya', amount: 2000, direction: 'borrowed' }),
    rec({ id: 'd', person: 'Anu', amount: 300 }),
  ]
  const payments = [
    { iou_id: 'a', amount: 1000, date: '2026-09-10' },
    { iou_id: 'd', amount: 300, date: '2026-09-12' },
  ]
  const s = summarizeIous(records, payments, '2026-09-29')

  it('totals what people owe you and what you owe', () => {
    expect(s.owedToYou).toBe(4000)
    expect(s.youOwe).toBe(3000)
  })

  it('groups a person ignoring case and spaces, nets both ways, open people first', () => {
    expect(s.people.map((p) => [p.person, p.net, p.open.length, p.settled.length])).toEqual([
      ['Ravi', 3000, 2, 0],
      ['Priya', -2000, 1, 0],
      ['Anu', 0, 0, 1],
    ])
  })
})

describe('reminderText', () => {
  it('uses the first name, the amount left and the date for a single record', () => {
    const line = iouLine(rec({ id: 'a', person: 'Ravi Kumar', date: '2026-09-12' }), [], '2026-09-29')
    expect(reminderText('Ravi Kumar', 1000, [line], (n) => `₹${n}`)).toBe(
      'Hi Ravi, just a gentle reminder about the ₹1000 from 12/09 I lent you. Thanks!'
    )
  })
})
