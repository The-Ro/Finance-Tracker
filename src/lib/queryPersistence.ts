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

/** A saved cache is only restored for the same user, and only while fresh. */
export function isRestorable<State>(
  saved: PersistedCache<State> | undefined,
  userId: string,
  now: number
): saved is PersistedCache<State> {
  return !!saved && saved.userId === userId && now - saved.savedAt <= PERSISTED_CACHE_MAX_AGE_MS
}
