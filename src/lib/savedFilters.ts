import type { TransactionFilters } from '@/lib/transactionSearch'

export const MAX_SAVED_FILTERS = 8

const TYPE_LABELS: Record<string, string> = { expense: 'Expenses', income: 'Income', transfer: 'Transfers' }

/** A short chip label for a filter set, e.g. `Expenses · Dining · "uber"`. */
export function describeFilters(f: TransactionFilters, ownerName?: string): string {
  const parts = [
    f.type ? TYPE_LABELS[f.type] ?? f.type : null,
    f.category,
    f.account,
    f.ownerId ? ownerName ?? 'One person' : null,
    f.search.trim() ? `"${f.search.trim()}"` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'All transactions'
}

function sameFilters(a: TransactionFilters, b: TransactionFilters): boolean {
  return (
    a.search.trim() === b.search.trim() &&
    a.type === b.type &&
    a.category === b.category &&
    a.account === b.account &&
    a.ownerId === b.ownerId
  )
}

/** Adds `f` to the front, dropping an identical older copy and anything past the cap. */
export function addSavedFilter(list: TransactionFilters[], f: TransactionFilters): TransactionFilters[] {
  const clean = { ...f, search: f.search.trim() }
  return [clean, ...list.filter((x) => !sameFilters(x, clean))].slice(0, MAX_SAVED_FILTERS)
}

export function isSaved(list: TransactionFilters[], f: TransactionFilters): boolean {
  return list.some((x) => sameFilters(x, f))
}
