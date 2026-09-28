import { hasActiveFilters, type TransactionFilters } from '@/lib/transactionSearch'

/** How long a saved cache is trusted for offline use. */
export const PERSISTED_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Bump when a release changes the shape of cached data (e.g. 1.7.0's account
 * kinds: a pre-1.7 cache held kind 'bank', which crashed Home before the
 * refetch landed). A saved cache from another version is never restored.
 */
export const PERSISTED_CACHE_VERSION = 2

export interface PersistedCache<State> {
  /** PERSISTED_CACHE_VERSION when saved; missing on caches from before 1.7.1. */
  version?: number
  userId: string
  savedAt: number
  state: State
}

function isFilters(value: unknown): value is TransactionFilters {
  return typeof value === 'object' && value !== null && 'search' in value && 'category' in value
}

/**
 * Which cached queries get saved for offline use. Everything the app reads is
 * saved, except the Transactions list's *filtered* variants -- each search or
 * filter combination is its own cache entry, and saving them all would grow
 * without bound for no offline benefit. The unfiltered list is kept.
 */
export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[0] === 'transactions' && typeof queryKey[1] === 'string' && queryKey[1].endsWith('-paginated')) {
    const filters = queryKey.find(isFilters)
    return !filters || !hasActiveFilters(filters)
  }
  return true
}

/**
 * What to wipe when the resolved signed-in user changes (null = nobody).
 * The in-memory cache goes whenever a *different* user (or nobody) replaces
 * the previous one -- some query keys don't include the user id, so one
 * user's cached data would otherwise render for the next. The saved copy goes
 * whenever nobody is signed in, including a launch with an expired session.
 */
export function cacheResetOnAuthChange(
  previousUserId: string | null,
  userId: string | null
): { clearMemory: boolean; deleteSaved: boolean } {
  return {
    clearMemory: previousUserId !== null && previousUserId !== userId,
    deleteSaved: userId === null,
  }
}

/** A saved cache is only restored for the same user, from this cache version, and only while fresh. */
export function isRestorable<State>(
  saved: PersistedCache<State> | undefined,
  userId: string,
  now: number
): saved is PersistedCache<State> {
  return (
    !!saved &&
    saved.version === PERSISTED_CACHE_VERSION &&
    saved.userId === userId &&
    now - saved.savedAt <= PERSISTED_CACHE_MAX_AGE_MS
  )
}
