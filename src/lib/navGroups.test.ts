import { describe, expect, it } from 'vitest'
import { groupNavItems } from './navGroups'

const items = [
  { to: '/', label: 'Home' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/goals', label: 'Goals' },
  { to: '/rules', label: 'Rules' },
]

const labels = (groups: { label: string; items: { label: string }[] }[]) =>
  groups.map((g) => [g.label, g.items.map((i) => i.label)])

describe('groupNavItems', () => {
  it('orders items by each section, not by the source list', () => {
    const groups = groupNavItems(items, [
      { label: 'Money', paths: ['/transactions', '/'] },
      { label: 'Plan', paths: ['/goals', '/budgets'] },
      { label: 'More', paths: ['/rules'] },
    ])
    expect(labels(groups)).toEqual([
      ['Money', ['Transactions', 'Home']],
      ['Plan', ['Goals', 'Budgets']],
      ['More', ['Rules']],
    ])
  })

  it('appends unclaimed items to the last section so no page goes missing', () => {
    const groups = groupNavItems(items, [
      { label: 'Money', paths: ['/'] },
      { label: 'More', paths: ['/rules'] },
    ])
    expect(labels(groups)).toEqual([
      ['Money', ['Home']],
      ['More', ['Rules', 'Transactions', 'Budgets', 'Goals']],
    ])
  })

  it('keeps each item once, ignores unknown paths and drops empty sections', () => {
    const groups = groupNavItems(items, [
      { label: 'Money', paths: ['/', '/nope', '/transactions'] },
      { label: 'Dupes', paths: ['/', '/nope'] },
      { label: 'Plan', paths: ['/budgets', '/goals', '/rules'] },
    ])
    expect(labels(groups)).toEqual([
      ['Money', ['Home', 'Transactions']],
      ['Plan', ['Budgets', 'Goals', 'Rules']],
    ])
    expect(groups.flatMap((g) => g.items)).toHaveLength(items.length)
  })

  it('still returns everything when there are no sections', () => {
    expect(labels(groupNavItems(items, []))).toEqual([
      ['More', ['Home', 'Transactions', 'Budgets', 'Goals', 'Rules']],
    ])
  })
})
