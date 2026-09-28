import { describe, expect, it } from 'vitest'
import {
  PERSISTED_CACHE_MAX_AGE_MS,
  cacheResetOnAuthChange,
  isRestorable,
  shouldPersistQueryKey,
} from '@/lib/queryPersistence'
import { EMPTY_TRANSACTION_FILTERS } from '@/lib/transactionSearch'

const range = { start: null, end: '2026-09-26' }

describe('shouldPersistQueryKey', () => {
  it('keeps ordinary queries', () => {
    expect(shouldPersistQueryKey(['budgets', 'u1'])).toBe(true)
    expect(shouldPersistQueryKey(['transactions', 'mine', 'u1'])).toBe(true)
  })

  it('keeps the unfiltered paginated list but drops filtered variants', () => {
    expect(shouldPersistQueryKey(['transactions', 'mine-paginated', 'u1', EMPTY_TRANSACTION_FILTERS, range])).toBe(true)
    expect(
      shouldPersistQueryKey(['transactions', 'everyone-paginated', { ...EMPTY_TRANSACTION_FILTERS, search: 'coffee' }, range])
    ).toBe(false)
  })
})

describe('cacheResetOnAuthChange', () => {
  it('keeps everything on first sign-in and while the same user stays', () => {
    expect(cacheResetOnAuthChange(null, 'u1')).toEqual({ clearMemory: false, deleteSaved: false })
    expect(cacheResetOnAuthChange('u1', 'u1')).toEqual({ clearMemory: false, deleteSaved: false })
  })

  it('clears memory when a different user replaces the previous one', () => {
    expect(cacheResetOnAuthChange('u1', 'u2')).toEqual({ clearMemory: true, deleteSaved: false })
  })

  it('deletes the saved copy whenever nobody is signed in', () => {
    expect(cacheResetOnAuthChange('u1', null)).toEqual({ clearMemory: true, deleteSaved: true })
    // Launch with an expired session: no previous user, but the blob must still go.
    expect(cacheResetOnAuthChange(null, null)).toEqual({ clearMemory: false, deleteSaved: true })
  })
})

describe('isRestorable', () => {
  const saved = { userId: 'u1', savedAt: 1_000, state: {} }
  it('restores only for the same user while fresh', () => {
    expect(isRestorable(saved, 'u1', 2_000)).toBe(true)
    expect(isRestorable(saved, 'u2', 2_000)).toBe(false)
    expect(isRestorable(saved, 'u1', 1_000 + PERSISTED_CACHE_MAX_AGE_MS + 1)).toBe(false)
    expect(isRestorable(undefined, 'u1', 2_000)).toBe(false)
  })
})
