import { describe, expect, it } from 'vitest'
import { budgetNotice, filterNotifications, overdueNotice, timeAgo } from './notifications'

describe('filterNotifications', () => {
  const list = [
    { id: 'a', read_at: null, created_at: '2026-09-30T10:00:00Z' },
    { id: 'b', read_at: '2026-09-30T11:00:00Z', created_at: '2026-09-29T10:00:00Z' },
  ]
  it('splits into all, unread and read', () => {
    expect(filterNotifications(list, 'all').map((n) => n.id)).toEqual(['a', 'b'])
    expect(filterNotifications(list, 'unread').map((n) => n.id)).toEqual(['a'])
    expect(filterNotifications(list, 'read').map((n) => n.id)).toEqual(['b'])
  })
})

describe('timeAgo', () => {
  const now = new Date(2026, 8, 30, 15, 0)
  it('reads naturally from seconds to dates', () => {
    expect(timeAgo(new Date(2026, 8, 30, 14, 59, 40).toISOString(), now)).toBe('Just now')
    expect(timeAgo(new Date(2026, 8, 30, 14, 55).toISOString(), now)).toBe('5 min ago')
    expect(timeAgo(new Date(2026, 8, 30, 9, 0).toISOString(), now)).toBe('6 h ago')
    expect(timeAgo(new Date(2026, 8, 29, 22, 0).toISOString(), now)).toBe('Yesterday')
    expect(timeAgo(new Date(2026, 8, 12, 9, 0).toISOString(), now)).toBe('Sep 12')
    expect(timeAgo(new Date(2025, 8, 12, 9, 0).toISOString(), now)).toBe('Sep 12, 2025')
  })
})

describe('own alerts', () => {
  const format = (n: number) => `₹${n}`
  it('words a budget alert and keys it per month and level', () => {
    const n = budgetNotice({ budgetId: 'b1', category: 'Dining', spent: 5200, limit: 5000, status: 'over' }, '2026-09', format)
    expect(n).toMatchObject({ ref: 'budget:b1:2026-09:over', title: 'Dining is over budget', url: '/budgets' })
    const near = budgetNotice({ budgetId: 'b1', category: 'Dining', spent: 4600, limit: 5000, status: 'approaching' }, '2026-09', format)
    expect(near.body).toBe('₹4600 of ₹5000 spent. ₹400 left this month.')
  })
  it('keys an overdue bill by its due date', () => {
    const n = overdueNotice({ id: 'r1', name: 'Rent', amount: 12000, next_date: '2026-09-28' }, format, () => 'Sep 28')
    expect(n).toMatchObject({ ref: 'overdue:r1:2026-09-28', title: 'Rent is overdue' })
  })
})
