import type { TransactionType } from '@/types/database.types'

export interface TransactionFilters {
  /** Free-text search across merchant, category, and (exact) tag. */
  search: string
  type: TransactionType | null
  category: string | null
  account: string | null
  /** Payment mode (transactions.payment_method), e.g. "UPI". */
  paymentMethod: string | null
  /** "Everyone" scope only -- narrow to one person's transactions. */
  ownerId: string | null
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  search: '',
  type: null,
  category: null,
  account: null,
  paymentMethod: null,
  ownerId: null,
}

/** The account filter can also name a debit card, as `debit:<card id>` (filters on debit_card_id), so saved filters keep working unchanged. */
export const DEBIT_CARD_FILTER_PREFIX = 'debit:'

export function parseAccountFilter(value: string | null): { account: string } | { debitCardId: string } | null {
  if (!value) return null
  return value.startsWith(DEBIT_CARD_FILTER_PREFIX)
    ? { debitCardId: value.slice(DEBIT_CARD_FILTER_PREFIX.length) }
    : { account: value }
}

export function hasActiveFilters(f: TransactionFilters): boolean {
  return !!f.search.trim() || !!f.type || !!f.category || !!f.account || !!f.paymentMethod || !!f.ownerId
}

/** Escapes LIKE/ILIKE wildcards so a user typing "50%" or "a_b" searches for
 *  those literal characters instead of matching everything. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Wraps a value in double quotes for a PostgREST filter string, escaping the
 *  backslash and quote characters. Required for any user text inside `.or()`,
 *  where an unquoted comma or parenthesis would be parsed as filter syntax. */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Builds the `.or()` filter string for a free-text search, or null when there
 * is nothing to search for. Merchant and category are case-insensitive
 * substring matches; tags are an EXACT (case-sensitive) element match, since
 * PostgREST can't do a substring match inside a text[] column -- the one
 * behavioral difference from the old client-side search.
 */
export function buildSearchOrFilter(search: string): string | null {
  const q = search.trim()
  if (!q) return null
  const pattern = quotePostgrestValue(`%${escapeLike(q)}%`)
  const tagArray = quotePostgrestValue(`{${quotePostgrestValue(q)}}`)
  return [`merchant.ilike.${pattern}`, `category.ilike.${pattern}`, `tags.cs.${tagArray}`].join(',')
}
