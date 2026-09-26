import { useState } from 'react'
import { Bookmark, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { addSavedFilter, describeFilters, isSaved } from '@/lib/savedFilters'
import { hasActiveFilters, type TransactionFilters } from '@/lib/transactionSearch'

interface SavedFiltersProps {
  filters: TransactionFilters
  onApply: (filters: TransactionFilters) => void
}

// Saved per user in this browser only (a convenience, like a remembered tab) --
// not synced across devices. Every access is guarded: storage can be blocked.
function storageKey(userId: string) {
  return `ledgeeaze:saved-filters:${userId}`
}
function load(userId: string | null): TransactionFilters[] {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as TransactionFilters[]) : []
  } catch {
    return []
  }
}
function persist(userId: string | null, list: TransactionFilters[]) {
  if (!userId) return
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list))
  } catch {
    // Storage full or blocked: the chips still work for this session.
  }
}

/** Chips for saved Transactions filter sets, plus a "Save this view" action. */
export function SavedFilters({ filters, onApply }: SavedFiltersProps) {
  const { userId } = useAuth()
  const [saved, setSaved] = useState(() => load(userId))
  const update = (next: TransactionFilters[]) => {
    setSaved(next)
    persist(userId, next)
  }
  const canSave = hasActiveFilters(filters) && !isSaved(saved, filters)
  if (saved.length === 0 && !canSave) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {saved.map((f, i) => (
        <span
          key={i}
          className="animate-fade-in inline-flex min-h-[36px] items-center rounded-full border border-app-border bg-app-card text-helper font-medium text-slate-700"
        >
          <button type="button" onClick={() => onApply(f)} className="min-h-[36px] pl-3 pr-1 hover:text-accent-dark">
            {describeFilters(f)}
          </button>
          <button
            type="button"
            aria-label={`Remove saved filter ${describeFilters(f)}`}
            onClick={() => update(saved.filter((_, j) => j !== i))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-danger"
          >
            <X size={13} />
          </button>
        </span>
      ))}
      {canSave && (
        <button
          type="button"
          onClick={() => update(addSavedFilter(saved, filters))}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-dashed border-accent px-3 text-helper font-medium text-accent-dark"
        >
          <Bookmark size={13} /> Save this view
        </button>
      )}
    </div>
  )
}
