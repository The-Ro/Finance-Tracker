import { describe, expect, it } from 'vitest'
import { investedBetween, investmentHistory, investmentMonthGrid, toggleMissedMonth, investmentSummary, isInvestmentEntry, looksLikeInvestment, monthlyAmount, pastDueDates, startPreview, type InvestItem } from './investments'

const item = (over: Partial<InvestItem> = {}): InvestItem => ({
  id: 'i1',
  name: 'Axis Bluechip SIP',
  amount: 5000,
  cadence: 'monthly',
  next_date: '2026-11-05',
  active: true,
  is_investment: true,
  goal_id: null,
  ...over,
})
const spend = (date: string, merchant: string, amount: number, extra: { tags?: string[]; category?: string; type?: string } = {}) => ({
  date,
  merchant,
  amount,
  type: extra.type ?? 'expense',
  category: extra.category ?? 'Other',
  tags: extra.tags ?? [],
})

describe('looksLikeInvestment', () => {
  it('spots common investments', () => {
    for (const n of ['Axis Bluechip SIP', 'PPF', 'NPS Tier 1', 'Groww mutual fund', 'Post office RD', 'Sukanya']) {
      expect(looksLikeInvestment(n)).toBe(true)
    }
  })
  it('leaves ordinary bills alone', () => {
    for (const n of ['Netflix', 'Rent', 'Car EMI', 'Electricity', 'Gym']) expect(looksLikeInvestment(n)).toBe(false)
  })
})

describe('monthlyAmount', () => {
  it('turns any cadence into a monthly figure', () => {
    expect(monthlyAmount(1200, 'annual')).toBe(100)
    expect(monthlyAmount(3000, 'quarterly')).toBe(1000)
    expect(monthlyAmount(1000, 'monthly')).toBe(1000)
  })
})

describe('isInvestmentEntry', () => {
  const names = new Set(['axis bluechip sip'])
  it('counts #invest, the Investments category and an investment payment by name', () => {
    expect(isInvestmentEntry(spend('2026-10-01', 'Zerodha', 100, { tags: ['invest'] }), names)).toBe(true)
    expect(isInvestmentEntry(spend('2026-10-01', 'Gold', 100, { category: 'Investments' }), names)).toBe(true)
    expect(isInvestmentEntry(spend('2026-10-01', 'AXIS BLUECHIP SIP', 100), names)).toBe(true)
  })
  it('never counts income or other spending', () => {
    expect(isInvestmentEntry(spend('2026-10-01', 'Axis Bluechip SIP', 100, { type: 'income' }), names)).toBe(false)
    expect(isInvestmentEntry(spend('2026-10-01', 'Swiggy', 100), names)).toBe(false)
  })
})

describe('investmentSummary', () => {
  const entries = [
    spend('2026-07-05', 'Axis Bluechip SIP', 5000),
    spend('2026-08-05', 'Axis Bluechip SIP', 5000, { tags: ['invest'] }),
    spend('2026-09-05', 'Axis Bluechip SIP', 5000, { tags: ['invest'] }),
    spend('2026-09-20', 'Gold coin', 2000, { tags: ['invest'] }),
    spend('2026-09-21', 'Swiggy', 400),
    spend('2026-09-30', 'Salary', 50000, { type: 'income' }),
    spend('2026-08-30', 'Salary', 50000, { type: 'income' }),
    spend('2026-07-30', 'Salary', 50000, { type: 'income' }),
    spend('2025-12-05', 'PPF', 10000, { tags: ['invest'] }),
  ]

  it('adds up what went in, this year and per investment', () => {
    const s = investmentSummary(entries, [item()], '2026-10-01')
    expect(s.total).toBe(27000)
    expect(s.thisYear).toBe(17000)
    expect(s.thisMonth).toBe(0)
    expect(s.items[0]).toMatchObject({ putIn: 15000, payments: 3, lastPaid: '2026-09-05' })
    expect(s.oneOff).toBe(12000)
    expect(s.first).toBe('2025-12-05')
  })

  it('counts the streak from last month when this month has nothing yet', () => {
    expect(investmentSummary(entries, [item()], '2026-10-01').streak).toBe(3)
  })

  it('gives the share of income invested over the last 3 full months', () => {
    // Jul-Sep: 17,000 invested of 150,000 in
    expect(investmentSummary(entries, [item()], '2026-10-01').incomeShare).toBeCloseTo(17000 / 150000)
  })

  it('plans only active investments, as a monthly amount', () => {
    const s = investmentSummary([], [item(), item({ id: 'i2', name: 'PPF', amount: 12000, cadence: 'annual' }), item({ id: 'i3', active: false })], '2026-10-01')
    expect(s.monthlyPlan).toBe(6000)
    expect(s.incomeShare).toBeNull()
  })

  it('keeps 12 months for the chart, oldest first', () => {
    const s = investmentSummary(entries, [item()], '2026-10-01')
    expect(s.byMonth).toHaveLength(12)
    expect(s.byMonth[0].month).toBe('2025-11')
    expect(s.byMonth[11]).toEqual({ month: '2026-10', amount: 0 })
    expect(s.byMonth.find((m) => m.month === '2026-09')?.amount).toBe(7000)
  })
})

describe('investedBetween', () => {
  it('sums only investments inside the dates', () => {
    const entries = [
      spend('2026-09-05', 'Axis Bluechip SIP', 5000),
      spend('2026-09-10', 'Swiggy', 300),
      spend('2026-10-05', 'Axis Bluechip SIP', 5000, { tags: ['invest'] }),
    ]
    expect(investedBetween(entries, [item()], { start: '2026-09-01', end: '2026-09-30' })).toBe(5000)
  })
})

describe('investment history from a start month', () => {
  const sip = item({ next_date: '2026-10-05', started_on: '2024-03-01' })

  it('counts every monthly due date from the start month up to next_date', () => {
    const d = pastDueDates(sip)
    expect(d[0]).toBe('2024-03-05')
    expect(d[d.length - 1]).toBe('2026-09-05')
    expect(d).toHaveLength(31)
  })

  it('takes missed months off what was put in', () => {
    const h = investmentHistory({ ...sip, missed_dates: ['2025-08-05', '2026-01-05'] })
    expect(h?.paid).toBe(29)
    expect(h?.putIn).toBe(145000)
  })

  it('ignores missed dates that are not due dates', () => {
    expect(investmentHistory({ ...sip, missed_dates: ['2027-01-05'] })?.paid).toBe(31)
  })

  it('works for yearly ones', () => {
    const ppf = item({ cadence: 'annual', amount: 12000, next_date: '2027-03-31', started_on: '2022-03-01' })
    expect(pastDueDates(ppf)).toEqual(['2022-03-31', '2023-03-31', '2024-03-31', '2025-03-31', '2026-03-31'])
  })

  it('previews a start month for the add form', () => {
    expect(startPreview(sip, '2026-07')).toEqual({ payments: 3, total: 15000 })
  })

  it('uses the history in the summary and does not count logged payments twice', () => {
    const s = investmentSummary(
      [spend('2026-09-05', 'Axis Bluechip SIP', 5000, { tags: ['invest'] })],
      [{ ...sip, missed_dates: ['2025-08-05'] }],
      '2026-10-01'
    )
    expect(s.total).toBe(150000)
    expect(s.items[0]).toMatchObject({ putIn: 150000, payments: 30 })
    expect(s.first).toBe('2024-03-05')
    expect(s.streak).toBe(13)
  })
})

describe('investmentMonthGrid', () => {
  const sip = item({ next_date: '2026-10-05', started_on: '2024-03-01', missed_dates: ['2025-08-05'] })

  it('has a row per year with paid, missed, due and blank months', () => {
    const g = investmentMonthGrid(sip, '2026-10-01')
    expect(g.map((r) => r.year)).toEqual([2024, 2025, 2026])
    expect(g[0].cells[1].state).toBe('none') // Feb 2024, before it started
    expect(g[0].cells[2].state).toBe('paid') // Mar 2024
    expect(g[1].cells[7].state).toBe('missed') // Aug 2025
    expect(g[2].cells[9].state).toBe('due') // Oct 2026
    expect(g[2].cells[10].state).toBe('none') // Nov 2026
  })

  it('flips a month between missed and paid', () => {
    const g = investmentMonthGrid(sip, '2026-10-01')
    expect(toggleMissedMonth(sip.missed_dates, g[1].cells[7])).toEqual([])
    expect(toggleMissedMonth(sip.missed_dates, g[0].cells[2])).toEqual(['2024-03-05', '2025-08-05'])
  })
})
