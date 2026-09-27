import { describe, expect, it } from 'vitest'
import {
  addToGoal,
  goalPace,
  goalPercent,
  isGoalReached,
  markGoalCelebrated,
  monthsUntil,
  parseDeposit,
  readCelebratedGoals,
  summarizeGoals,
} from '@/lib/goals'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('goalPercent / isGoalReached', () => {
  it('clamps to 0-100 and handles a zero target', () => {
    expect(goalPercent({ current_amount: 40, target_amount: 100 })).toBe(40)
    expect(goalPercent({ current_amount: 150, target_amount: 100 })).toBe(100)
    expect(goalPercent({ current_amount: 10, target_amount: 0 })).toBe(0)
    expect(isGoalReached({ current_amount: 100, target_amount: 100 })).toBe(true)
    expect(isGoalReached({ current_amount: 99.99, target_amount: 100 })).toBe(false)
    expect(isGoalReached({ current_amount: 0, target_amount: 0 })).toBe(false)
  })
})

describe('summarizeGoals', () => {
  it('totals saved and targets across goals', () => {
    expect(
      summarizeGoals([
        { current_amount: 120000, target_amount: 300000 },
        { current_amount: 18500, target_amount: 25000 },
        { current_amount: 32000, target_amount: 90000 },
        { current_amount: 5000, target_amount: 5000 },
      ])
    ).toEqual({ saved: 175500, target: 420000, count: 4, reached: 1 })
  })

  it('is all zeros for no goals', () => {
    expect(summarizeGoals([])).toEqual({ saved: 0, target: 0, count: 0, reached: 0 })
  })
})

describe('monthsUntil', () => {
  it('rounds partial months up and never goes below 1', () => {
    expect(monthsUntil('2026-09-27', '2027-09-27')).toBe(12)
    expect(monthsUntil('2026-09-27', '2026-12-15')).toBe(3)
    expect(monthsUntil('2026-09-27', '2026-12-27')).toBe(3)
    expect(monthsUntil('2026-09-27', '2026-12-28')).toBe(4)
    expect(monthsUntil('2026-09-27', '2026-09-30')).toBe(1)
    expect(monthsUntil('2026-09-27', '2026-09-27')).toBe(1)
  })
})

describe('goalPace', () => {
  const today = '2026-09-27'

  it('reports reached goals first', () => {
    expect(goalPace({ current_amount: 100, target_amount: 100, due_date: '2020-01-01' }, today)).toEqual({ kind: 'reached' })
  })

  it('says so when there is no due date', () => {
    expect(goalPace({ current_amount: 32000, target_amount: 90000, due_date: null }, today)).toEqual({
      kind: 'no-date',
      remaining: 58000,
    })
  })

  it('flags a due date already passed', () => {
    expect(goalPace({ current_amount: 10, target_amount: 100, due_date: '2026-09-26' }, today)).toEqual({
      kind: 'overdue',
      remaining: 90,
    })
  })

  it('treats the due date itself as still schedulable (one month left)', () => {
    const pace = goalPace({ current_amount: 10, target_amount: 100, due_date: today }, today)
    expect(pace).toMatchObject({ kind: 'scheduled', months: 1, monthly: 90 })
  })

  it('computes the monthly amount needed', () => {
    const pace = goalPace({ current_amount: 120000, target_amount: 300000, due_date: '2027-09-27' }, today)
    expect(pace).toEqual({ kind: 'scheduled', remaining: 180000, monthly: 15000, months: 12, onTrack: true })
  })

  it('is on track when saved is at or ahead of a straight line from the start date', () => {
    // Halfway from 2026-01-01 to 2027-01-01 is ~2026-07-02; by 2026-09-27 ~74% should be saved.
    const base = { target_amount: 1000, due_date: '2027-01-01', start_date: '2026-01-01' }
    expect(goalPace({ ...base, current_amount: 800 }, today)).toMatchObject({ onTrack: true })
    expect(goalPace({ ...base, current_amount: 500 }, today)).toMatchObject({ onTrack: false })
  })

  it('falls back to on track when the start date is missing or not before the due date', () => {
    expect(goalPace({ current_amount: 0, target_amount: 100, due_date: '2027-01-01', start_date: null }, today)).toMatchObject({
      onTrack: true,
    })
    expect(
      goalPace({ current_amount: 0, target_amount: 100, due_date: '2027-01-01', start_date: '2027-02-01' }, today)
    ).toMatchObject({ onTrack: true })
  })

  it('a goal created today with nothing saved is on track', () => {
    expect(goalPace({ current_amount: 0, target_amount: 100, due_date: '2027-01-01', start_date: today }, today)).toMatchObject({
      onTrack: true,
    })
  })
})

describe('addToGoal / parseDeposit', () => {
  it('adds with cent rounding', () => {
    expect(addToGoal(0.1, 0.2)).toBe(0.3)
    expect(addToGoal(18500, 1500)).toBe(20000)
  })

  it('accepts only positive numbers', () => {
    expect(parseDeposit('1,500')).toBe(1500)
    expect(parseDeposit(' 250.555 ')).toBe(250.56)
    expect(parseDeposit('')).toBeNull()
    expect(parseDeposit('0')).toBeNull()
    expect(parseDeposit('-5')).toBeNull()
    expect(parseDeposit('abc')).toBeNull()
  })
})

describe('celebrated goals', () => {
  it('remembers each goal once', () => {
    const storage = memoryStorage()
    expect(readCelebratedGoals(storage).size).toBe(0)
    markGoalCelebrated('a', storage)
    markGoalCelebrated('a', storage)
    markGoalCelebrated('b', storage)
    expect([...readCelebratedGoals(storage)]).toEqual(['a', 'b'])
  })

  it('survives garbage and missing storage', () => {
    const storage = memoryStorage()
    storage.setItem('ledgeeaze:goals-celebrated', '{not json')
    expect(readCelebratedGoals(storage).size).toBe(0)
    expect(readCelebratedGoals(null).size).toBe(0)
    expect(() => markGoalCelebrated('x', null)).not.toThrow()
  })
})
