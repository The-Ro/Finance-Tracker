import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { duplicatePairs } from '@/lib/duplicates'

const keyFor = (userId: string) => `ledgeeaze:dup-dismissed:${userId}`

function read(userId: string | null): Set<string> {
  if (!userId) return new Set()
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/**
 * Pairs the user marked "Not a duplicate", remembered on this device (per
 * user) so they stop coming back -- they used to reappear on the next open.
 */
export function useDismissedDuplicates() {
  const { userId } = useAuth()
  const [dismissed, setDismissed] = useState<Set<string>>(() => read(userId))
  useEffect(() => setDismissed(read(userId)), [userId])

  const dismiss = useCallback(
    (group: { id: string }[]) => {
      if (!userId) return
      setDismissed((prev) => {
        const next = new Set(prev)
        for (const p of duplicatePairs(group)) next.add(p)
        try {
          localStorage.setItem(keyFor(userId), JSON.stringify([...next]))
        } catch {
          // Storage full or blocked: still hidden for now, just not remembered.
        }
        return next
      })
    },
    [userId]
  )

  return { dismissed, dismiss }
}
