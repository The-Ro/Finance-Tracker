import { describe, expect, it } from 'vitest'
import { avatarTone, dayHeadingLabel, dayNetTotals, dragOffset, groupByDay, merchantInitial, privateDecoy, snapOffset, withPrivateRows } from './activityList'

describe('groupByDay', () => {
  it('groups rows per day in first-seen order with a net per day', () => {
    const groups = groupByDay([
      { id: 'a', date: '2026-09-27', type: 'expense' as const, amount: 1284 },
      { id: 'b', date: '2026-09-27', type: 'expense' as const, amount: 449 },
      { id: 'c', date: '2026-09-26', type: 'income' as const, amount: 62000 },
      { id: 'd', date: '2026-09-26', type: 'transfer' as const, amount: 5000 },
      { id: 'e', date: '2026-09-25', type: 'transfer' as const, amount: 100 },
    ])
    expect(groups.map((g) => g.date)).toEqual(['2026-09-27', '2026-09-26', '2026-09-25'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[0].net).toBe(-1733)
    expect(groups[1].net).toBe(62000)
    // Only transfers: no total to show.
    expect(groups[2].net).toBeNull()
  })
  it('puts a later page continuing the same day into that day, not a new group', () => {
    const page1 = [
      { id: 'a', date: '2026-09-27', type: 'expense' as const, amount: 10 },
      { id: 'b', date: '2026-09-26', type: 'expense' as const, amount: 20 },
    ]
    const page2 = [
      { id: 'c', date: '2026-09-26', type: 'income' as const, amount: 50 },
      { id: 'd', date: '2026-09-24', type: 'expense' as const, amount: 5 },
    ]
    const groups = groupByDay([...page1, ...page2])
    expect(groups.map((g) => g.date)).toEqual(['2026-09-27', '2026-09-26', '2026-09-24'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['b', 'c'])
    expect(groups[1].net).toBe(30)
  })
  it('returns no groups for no rows', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('dayHeadingLabel', () => {
  const today = '2026-09-27'
  it('names today and yesterday with the weekday and date', () => {
    expect(dayHeadingLabel('2026-09-27', today)).toBe('Today · Sun 27 Sep')
    expect(dayHeadingLabel('2026-09-26', today)).toBe('Yesterday · Sat 26 Sep')
  })
  it('shows weekday and date otherwise, adding the year only when it differs', () => {
    expect(dayHeadingLabel('2026-09-25', today)).toBe('Fri 25 Sep')
    expect(dayHeadingLabel('2025-12-31', today)).toBe('Wed 31 Dec 2025')
  })
  it('handles yesterday across a month and year boundary', () => {
    expect(dayHeadingLabel('2026-02-28', '2026-03-01')).toBe('Yesterday · Sat 28 Feb')
    expect(dayHeadingLabel('2025-12-31', '2026-01-01')).toBe('Yesterday · Wed 31 Dec 2025')
  })
})

describe('dayNetTotals', () => {
  it('adds income, subtracts expenses and skips transfers per day', () => {
    const totals = dayNetTotals([
      { date: '2026-09-27', type: 'expense', amount: 1284 },
      { date: '2026-09-27', type: 'expense', amount: 449 },
      { date: '2026-09-26', type: 'income', amount: 62000 },
      { date: '2026-09-26', type: 'expense', amount: 342 },
      { date: '2026-09-26', type: 'transfer', amount: 5000 },
      { date: '2026-09-25', type: 'transfer', amount: 100 },
    ])
    expect(totals.get('2026-09-27')).toBe(-1733)
    expect(totals.get('2026-09-26')).toBe(61658)
    expect(totals.has('2026-09-25')).toBe(false)
  })
  it('rounds float noise', () => {
    const totals = dayNetTotals([
      { date: '2026-01-01', type: 'income', amount: 0.1 },
      { date: '2026-01-01', type: 'income', amount: 0.2 },
    ])
    expect(totals.get('2026-01-01')).toBe(0.3)
  })
})

describe('merchantInitial', () => {
  it('takes the first letter or digit', () => {
    expect(merchantInitial('fresh mart')).toBe('F')
    expect(merchantInitial('  *Uber')).toBe('U')
    expect(merchantInitial('7-Eleven')).toBe('7')
    expect(merchantInitial('')).toBe('?')
    expect(merchantInitial(null)).toBe('?')
  })
})

describe('avatarTone', () => {
  it('keeps income green and transfers neutral', () => {
    expect(avatarTone('Salary', 'income')).toBe('positive')
    expect(avatarTone(null, 'transfer')).toBe('neutral')
    expect(avatarTone(null, 'expense')).toBe('neutral')
  })
  it('is stable per category and never positive for an expense', () => {
    expect(avatarTone('Groceries', 'expense')).toBe(avatarTone(' groceries ', 'expense'))
    for (const c of ['Dining', 'Travel', 'Rent', 'Shopping', 'Health', 'Fuel']) {
      expect(avatarTone(c, 'expense')).not.toBe('positive')
    }
  })
})

describe('swipe math', () => {
  it('clamps the drag and resists past fully open', () => {
    expect(dragOffset(0, 40, 228)).toBe(0)
    expect(dragOffset(0, -100, 228)).toBe(-100)
    expect(dragOffset(-228, -40, 228)).toBe(-238)
    expect(dragOffset(-228, 300, 228)).toBe(0)
  })
  it('snaps open past a third, or on a flick', () => {
    expect(snapOffset(-50, 228)).toBe(0)
    expect(snapOffset(-80, 228)).toBe(-228)
    expect(snapOffset(-20, 228, -0.8)).toBe(-228)
    expect(snapOffset(-200, 228, 0.8)).toBe(0)
    expect(snapOffset(-50, 0)).toBe(0)
  })
})

describe('withPrivateRows', () => {
  const rows = [
    { date: '2026-09-30', type: 'expense' as const, amount: 10 },
    { date: '2026-09-28', type: 'income' as const, amount: 50 },
  ]
  it('joins existing days and starts new ones, newest first, without touching totals', () => {
    const groups = withPrivateRows(groupByDay(rows), [
      { id: 'a', owner_user_id: 'x', date: '2026-09-30' },
      { id: 'b', owner_user_id: 'x', date: '2026-09-29' },
    ])
    expect(groups.map((g) => [g.date, g.rows.length, g.privateRows.length, g.net])).toEqual([
      ['2026-09-30', 1, 1, -10],
      ['2026-09-29', 0, 1, null],
      ['2026-09-28', 1, 0, 50],
    ])
  })
  it('leaves groups alone with no placeholders', () => {
    expect(withPrivateRows(groupByDay(rows), []).every((g) => g.privateRows.length === 0)).toBe(true)
  })
})

describe('privateDecoy', () => {
  it('is the same for the same entry and varies between entries', () => {
    expect(privateDecoy('abc-123')).toEqual(privateDecoy('abc-123'))
    const looks = new Set(['a1', 'b2', 'c3', 'd4', 'e5', 'f6'].map((id) => JSON.stringify(privateDecoy(id))))
    expect(looks.size).toBeGreaterThan(3)
  })

  it('gives a 3 to 5 digit amount', () => {
    for (const id of ['x', 'yy', 'zzz', 'q-9']) expect(privateDecoy(id).amount.replace(/,/g, '')).toMatch(/^\d{3,5}$/)
  })
})
