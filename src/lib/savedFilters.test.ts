import { describe, expect, it } from 'vitest'
import {
  addSavedFilter,
  describeFilters,
  isSaved,
  MAX_SAVED_FILTERS,
  normalizeSavedFilter,
  parseSavedFilters,
  toFilters,
} from './savedFilters'
import { EMPTY_TRANSACTION_FILTERS } from './transactionSearch'

const dining = { ...EMPTY_TRANSACTION_FILTERS, type: 'expense' as const, category: 'Dining', search: ' uber ' }

describe('savedFilters', () => {
  it('describes a filter set', () => {
    expect(describeFilters(dining)).toBe('Money out · Dining · "uber"')
    expect(describeFilters(EMPTY_TRANSACTION_FILTERS)).toBe('All transactions')
    expect(describeFilters({ ...dining, scope: 'everyone', period: 'this-month' })).toBe(
      'Everyone · This month · Money out · Dining · "uber"'
    )
    expect(describeFilters({ ...EMPTY_TRANSACTION_FILTERS, scope: 'mine', period: 'all-time' })).toBe('All transactions')
  })
  it('dedupes, trims and caps', () => {
    let list = addSavedFilter([], dining)
    list = addSavedFilter(list, { ...dining, search: 'uber' })
    expect(list).toHaveLength(1)
    expect(isSaved(list, { ...dining, search: 'uber' })).toBe(true)
    for (let i = 0; i < 12; i++) list = addSavedFilter(list, { ...EMPTY_TRANSACTION_FILTERS, search: `s${i}` })
    expect(list).toHaveLength(MAX_SAVED_FILTERS)
    expect(list[0].search).toBe('s11')
  })
  it('treats scope and period as part of the saved view', () => {
    const list = addSavedFilter([], { ...dining, scope: 'mine', period: 'this-month' })
    expect(isSaved(list, { ...dining, search: 'uber', scope: 'mine', period: 'this-month' })).toBe(true)
    expect(isSaved(list, { ...dining, scope: 'everyone', period: 'this-month' })).toBe(false)
    expect(isSaved(list, { ...dining, scope: 'mine', period: 'last-month' })).toBe(false)
  })
})

describe('loading stored entries', () => {
  it('keeps old entries (no scope/period) loading with defaults', () => {
    const old = JSON.stringify([{ search: 'uber', type: 'expense', category: null, account: 'HDFC', ownerId: null }])
    const [f] = parseSavedFilters(old)
    expect(f).toEqual({ ...EMPTY_TRANSACTION_FILTERS, search: 'uber', type: 'expense', account: 'HDFC' })
    expect(f.scope).toBeUndefined()
    expect(f.period).toBeUndefined()
  })
  it('infers Everyone for an old entry with a person filter', () => {
    expect(normalizeSavedFilter({ search: '', ownerId: 'u2' })?.scope).toBe('everyone')
  })
  it('fills missing fields and drops invalid values', () => {
    expect(normalizeSavedFilter({ type: 'bogus', period: 'forever', scope: 'all' })).toEqual(EMPTY_TRANSACTION_FILTERS)
    expect(normalizeSavedFilter({ scope: 'mine', ownerId: 'u2' })?.ownerId).toBeNull()
    expect(normalizeSavedFilter('nope')).toBeNull()
    expect(normalizeSavedFilter(null)).toBeNull()
  })
  it('restores scope and period when present', () => {
    const f = normalizeSavedFilter({ search: 'x', scope: 'everyone', period: 'last-3-months' })
    expect(f?.scope).toBe('everyone')
    expect(f?.period).toBe('last-3-months')
    expect(toFilters(f!)).toEqual({ ...EMPTY_TRANSACTION_FILTERS, search: 'x' })
  })
  it('survives unreadable storage', () => {
    expect(parseSavedFilters(null)).toEqual([])
    expect(parseSavedFilters('{not json')).toEqual([])
    expect(parseSavedFilters('{"a":1}')).toEqual([])
    expect(parseSavedFilters('[null, 3, {"search":"a"}]')).toHaveLength(1)
  })
})
