import { hasActiveFilters, type TransactionFilters } from '@/lib/transactionSearch'

/** How long a saved cache is trusted for offline use. */
export const PERSISTED_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface PersistedCache<State> {
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

/** A saved cache is only restored for the same user, and only while fresh. */
export function isRestorable<State>(
  saved: PersistedCache<State> | undefined,
  userId: string,
  now: number
): saved is PersistedCache<State> {
  return !!saved && saved.userId === userId && now - saved.savedAt <= PERSISTED_CACHE_MAX_AGE_MS
}
