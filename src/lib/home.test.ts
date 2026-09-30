import { describe, expect, it } from 'vitest'
import { budgetSpendSummary, dueWithin, firstName, greetingFor, isBirthdayToday, sparklinePath, zodiacFor } from './home'

describe('greetingFor', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(greetingFor(5)).toBe('Good morning')
    expect(greetingFor(11)).toBe('Good morning')
    expect(greetingFor(12)).toBe('Good afternoon')
    expect(greetingFor(16)).toBe('Good afternoon')
    expect(greetingFor(17)).toBe('Good evening')
    expect(greetingFor(23)).toBe('Good evening')
    expect(greetingFor(2)).toBe('Good evening')
  })
})

describe('firstName', () => {
  it('takes the first word and tolerates blanks', () => {
    expect(firstName('  Rohith  Kumar ')).toBe('Rohith')
    expect(firstName('Asha')).toBe('Asha')
    expect(firstName('')).toBe('')
    expect(firstName(null)).toBe('')
  })
})

describe('sparklinePath', () => {
  it('maps the lowest value to the bottom and the highest to the top', () => {
    expect(sparklinePath([0, 10], 100, 20, 0)).toBe('M0 20 L100 0')
    expect(sparklinePath([5, 0, 10], 100, 24, 2)).toBe('M0 12 L50 22 L100 2')
  })

  it('draws a flat series and a single point through the middle', () => {
    expect(sparklinePath([3, 3, 3], 100, 20)).toBe('M0 10 L50 10 L100 10')
    expect(sparklinePath([42], 100, 20)).toBe('M0 10 L100 10')
    expect(sparklinePath([], 100, 20)).toBe('')
  })
})

describe('budgetSpendSummary', () => {
  const budgets = [
    { category: 'Rent', limit: 20000 },
    { category: 'Groceries', limit: 8000 },
    { category: 'Dining', limit: 4000 },
    { category: 'Transport', limit: 3000 },
    { category: 'Fun', limit: 5000 },
  ]

  it('sums budgeted spend only, keeps the top categories and folds the rest into Other', () => {
    const spent = new Map([
      ['Rent', 18000],
      ['Groceries', 6000],
      ['Dining', 2000],
      ['Transport', 1200],
      ['Fun', 800],
      ['Unbudgeted', 9999],
    ])
    const s = budgetSpendSummary(budgets, spent)
    expect(s.total).toBe(40000)
    expect(s.spent).toBe(28000)
    expect(s.segments.map((x) => x.category)).toEqual(['Rent', 'Groceries', 'Dining', 'Other'])
    expect(s.segments[0].percent).toBe(45)
    expect(s.segments[3].amount).toBe(2000)
    expect(s.segments[3].percent).toBe(5)
  })

  it('sizes against spend when over the limit so the bar never overflows', () => {
    const s = budgetSpendSummary([{ category: 'Dining', limit: 100 }], new Map([['Dining', 400]]))
    expect(s.segments).toEqual([{ category: 'Dining', amount: 400, percent: 100 }])
  })

  it('has no segments when nothing was spent', () => {
    const s = budgetSpendSummary(budgets, new Map())
    expect(s.spent).toBe(0)
    expect(s.segments).toEqual([])
  })
})

describe('dueWithin', () => {
  const rent = { id: 'rent', next_date: '2026-10-01', cadence: 'monthly' as const, active: true, amount: 18000 }
  const gym = { id: 'gym', next_date: '2026-09-28', cadence: 'weekly' as const, active: true, amount: 500 }
  const late = { id: 'late', next_date: '2026-09-20', cadence: 'monthly' as const, active: true, amount: 649 }
  const off = { id: 'off', next_date: '2026-09-29', cadence: 'monthly' as const, active: false, amount: 1 }

  it('lists overdue items once, then every occurrence in the next 7 days, soonest first', () => {
    const rows = dueWithin([rent, gym, late, off], '2026-09-27')
    expect(rows.map((r) => [r.item.id, r.date, r.overdue])).toEqual([
      ['late', '2026-09-20', true],
      ['gym', '2026-09-28', false],
      ['rent', '2026-10-01', false],
    ])
  })

  it('includes repeat occurrences inside the window', () => {
    const daily = { ...gym, next_date: '2026-09-27' }
    expect(dueWithin([daily], '2026-09-27', 8).map((r) => r.date)).toEqual(['2026-09-27', '2026-10-04'])
  })
})

describe('isBirthdayToday', () => {
  it('matches month and day, whatever the year', () => {
    expect(isBirthdayToday('1990-09-30', '2026-09-30')).toBe(true)
    expect(isBirthdayToday('1990-09-29', '2026-09-30')).toBe(false)
    expect(isBirthdayToday(null, '2026-09-30')).toBe(false)
  })
  it('puts a 29 Feb birthday on 28 Feb in other years', () => {
    expect(isBirthdayToday('2000-02-29', '2027-02-28')).toBe(true)
    expect(isBirthdayToday('2000-02-29', '2028-02-28')).toBe(false)
    expect(isBirthdayToday('2000-02-29', '2028-02-29')).toBe(true)
  })
})

describe('zodiacFor', () => {
  it('finds the sun sign, including across the new year', () => {
    expect(zodiacFor('1990-09-30')).toBe('libra')
    expect(zodiacFor('1990-12-25')).toBe('capricorn')
    expect(zodiacFor('1990-01-19')).toBe('capricorn')
    expect(zodiacFor('1990-02-29')).toBe('pisces')
    expect(zodiacFor('1990-03-21')).toBe('aries')
  })
})
