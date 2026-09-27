import { EMPTY_TRANSACTION_FILTERS, type TransactionFilters } from '@/lib/transactionSearch'
import { PERIOD_OPTIONS } from '@/lib/period'
import type { SelectedPeriod, TransactionType } from '@/types/database.types'

export const MAX_SAVED_FILTERS = 8

export type SavedScope = 'mine' | 'everyone'

/**
 * A saved Transactions view: the filters plus, since the Activity redesign,
 * the Mine/Everyone scope and the period. Entries saved before that have no
 * `scope`/`period` -- restoring one leaves the current scope/period alone.
 */
export interface SavedFilter extends TransactionFilters {
  scope?: SavedScope
  period?: SelectedPeriod
}

const TYPE_LABELS: Record<string, string> = { expense: 'Money out', income: 'Money in', transfer: 'Transfers' }
const TYPES: TransactionType[] = ['expense', 'income', 'transfer']
const PERIODS = new Set<string>(PERIOD_OPTIONS.map((p) => p.value))

/** A short chip label for a saved view, e.g. `Everyone · This month · Money out · Dining · "uber"`. */
export function describeFilters(f: SavedFilter, ownerName?: string): string {
  const parts = [
    f.scope === 'everyone' ? 'Everyone' : null,
    f.period && f.period !== 'all-time' ? PERIOD_OPTIONS.find((p) => p.value === f.period)?.label ?? null : null,
    f.type ? TYPE_LABELS[f.type] ?? f.type : null,
    f.category,
    f.account,
    f.ownerId ? ownerName ?? 'One person' : null,
    f.search.trim() ? `"${f.search.trim()}"` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'All transactions'
}

function sameFilters(a: SavedFilter, b: SavedFilter): boolean {
  return (
    a.search.trim() === b.search.trim() &&
    a.type === b.type &&
    a.category === b.category &&
    a.account === b.account &&
    a.ownerId === b.ownerId &&
    a.scope === b.scope &&
    a.period === b.period
  )
}

/** Adds `f` to the front, dropping an identical older copy and anything past the cap. */
export function addSavedFilter(list: SavedFilter[], f: SavedFilter): SavedFilter[] {
  const clean = { ...f, search: f.search.trim() }
  return [clean, ...list.filter((x) => !sameFilters(x, clean))].slice(0, MAX_SAVED_FILTERS)
}

export function isSaved(list: SavedFilter[], f: SavedFilter): boolean {
  return list.some((x) => sameFilters(x, f))
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/**
 * Reads one stored entry defensively (it came from localStorage, so it may be
 * from an older version or hand-edited). Missing filter fields fall back to
 * the empty defaults; a missing scope stays missing (keep the current one),
 * except an old entry with a person filter, which only ever existed in the
 * Everyone scope. Returns null for anything that isn't an object.
 */
export function normalizeSavedFilter(raw: unknown): SavedFilter | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const type = TYPES.includes(r.type as TransactionType) ? (r.type as TransactionType) : null
  const ownerId = str(r.ownerId)
  const scope: SavedScope | undefined =
    r.scope === 'mine' || r.scope === 'everyone' ? r.scope : ownerId ? 'everyone' : undefined
  const period = typeof r.period === 'string' && PERIODS.has(r.period) ? (r.period as SelectedPeriod) : undefined
  const f: SavedFilter = {
    ...EMPTY_TRANSACTION_FILTERS,
    search: typeof r.search === 'string' ? r.search : '',
    type,
    category: str(r.category),
    account: str(r.account),
    ownerId: scope === 'mine' ? null : ownerId,
  }
  if (scope) f.scope = scope
  if (period) f.period = period
  return f
}

/** Parses the stored JSON list; anything unreadable yields an empty list. */
export function parseSavedFilters(json: string | null): SavedFilter[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeSavedFilter).filter((f): f is SavedFilter => f !== null).slice(0, MAX_SAVED_FILTERS)
  } catch {
    return []
  }
}

/** Splits a saved view back into the parts the page restores separately. */
export function toFilters(f: SavedFilter): TransactionFilters {
  return { search: f.search, type: f.type, category: f.category, account: f.account, ownerId: f.ownerId }
}
