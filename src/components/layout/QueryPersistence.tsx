import { useEffect, useRef } from 'react'
import { dehydrate, hydrate, useQueryClient, type DehydratedState } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { idbDelete, idbGet, idbSet } from '@/lib/idbStore'
import { isRestorable, shouldPersistQueryKey, type PersistedCache } from '@/lib/queryPersistence'

const CACHE_KEY = 'query-cache'
const SAVE_THROTTLE_MS = 2_000

/**
 * Offline read support: saves the signed-in user's query cache to IndexedDB
 * and restores it on the next load, so the app shows the last-seen data
 * instead of an empty skeleton with no connection. Read-only by design --
 * mutations made offline just wait (TanStack pauses them) and only go through
 * if the tab is still open when the connection comes back.
 *
 * Scoped to one user: a saved cache is only restored for the same userId, and
 * both the in-memory and saved cache are wiped as soon as the user signs out.
 * hydrate() never overwrites a query with older data, so a restore that lands
 * after a fresh fetch is harmless.
 */
export function QueryPersistence() {
  const queryClient = useQueryClient()
  const { userId, loading } = useAuth()
  const previousUserId = useRef<string | null>(null)

  // Restore / wipe on sign-in and sign-out.
  useEffect(() => {
    if (loading) return
    const previous = previousUserId.current
    previousUserId.current = userId

    if (!userId) {
      if (previous) {
        queryClient.clear()
        idbDelete(CACHE_KEY).catch(() => {})
      }
      return
    }

    let cancelled = false
    idbGet<PersistedCache<DehydratedState>>(CACHE_KEY)
      .then((saved) => {
        if (cancelled) return
        if (isRestorable(saved, userId, Date.now())) {
          hydrate(queryClient, saved.state)
          // Restored data is only a placeholder while offline: refetch it all
          // straight away so an old snapshot (e.g. from before an import) can
          // never linger on screen.
          if (navigator.onLine) queryClient.invalidateQueries()
        }
        else if (saved) idbDelete(CACHE_KEY).catch(() => {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, loading, queryClient])

  // An installed PWA reopened after a while can fire its first requests with an
  // expired token (401) before Supabase refreshes the session; those queries
  // then sit on stale/restored data. Retry anything that errored once the
  // token is refreshed, and everything when the device comes back online.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ predicate: (q) => q.state.status === 'error' })
      }
    })
    const onOnline = () => queryClient.invalidateQueries()
    window.addEventListener('online', onOnline)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
    }
  }, [queryClient])

  // Save (throttled) whenever the cache changes.
  useEffect(() => {
    if (!userId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      timer = undefined
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersistQueryKey(q.queryKey),
      })
      const entry: PersistedCache<DehydratedState> = { userId, savedAt: Date.now(), state }
      idbSet(CACHE_KEY, entry).catch(() => {})
    }
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' && event.type !== 'removed') return
      if (!timer) timer = setTimeout(save, SAVE_THROTTLE_MS)
    })
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [userId, queryClient])

  return null
}
