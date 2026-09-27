import { useMemo } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { buildFingerprint } from '@/lib/fingerprint'
import { applyRules, type SimpleRule } from '@/lib/rules'
import { calculateAccountBalances } from '@/lib/accountBalances'
import { useAccountOpeningBalances } from '@/hooks/useLookupLists'
import { buildSearchOrFilter, type TransactionFilters } from '@/lib/transactionSearch'
import type { DateRange } from '@/lib/period'
import type { Database, PaymentMethod, TransactionType } from '@/types/database.types'

export type Transaction = Database['public']['Tables']['transactions']['Row']

export interface NewTransactionInput {
  date: string
  merchant: string
  category: string | null
  amount: number
  type: TransactionType
  account: string
  toAccount?: string | null
  remarks?: string | null
  paymentMethod?: PaymentMethod | null
  tags: string[]
  receipt: boolean
  receiptDocumentId?: string | null
  /** Set together for a foreign-currency entry (see src/lib/fx.ts); `amount`
   *  is then the home-currency conversion. Omit/null for home currency. */
  foreign?: ForeignAmount | null
}

export interface ForeignAmount {
  currency: string
  amount: number
  rate: number
}

function foreignColumns(foreign: ForeignAmount | null | undefined) {
  return foreign
    ? { original_currency: foreign.currency, original_amount: foreign.amount, fx_rate: foreign.rate }
    : { original_currency: null, original_amount: null, fx_rate: null }
}

const DUPLICATE_CODE = '23505'

/** Thrown instead of a plain Error on a fingerprint collision, so callers
 *  (AddEntryModal) can offer a "Save anyway" retry instead of just failing --
 *  the fingerprint is date+merchant+amount+account only (no category, see
 *  fingerprint.ts), so two genuinely different transactions that happen to
 *  share all four (e.g. two same-day, same-amount purchases at the same
 *  merchant, logged under different categories) collide here even though
 *  neither is actually a duplicate. */
export class DuplicateTransactionError extends Error {
  constructor() {
    super('This looks like a duplicate of a transaction you already logged.')
    this.name = 'DuplicateTransactionError'
  }
}

/** Appended to the canonical fingerprint when the caller has explicitly
 *  confirmed "save anyway" on a reported duplicate -- guarantees a fresh
 *  unique constraint match without changing buildFingerprint's own contract
 *  (CSV import's upsert/ignoreDuplicates dedup still matches against the
 *  canonical, un-suffixed fingerprint). */
function withDuplicateOverride(fingerprint: string, allowDuplicate: boolean | undefined): string {
  return allowDuplicate ? `${fingerprint}|dup-${crypto.randomUUID().slice(0, 8)}` : fingerprint
}

/** Both transaction queries below cap out at this many rows -- there's no
 *  pagination yet, so a list that hits the cap is silently missing older
 *  rows. Exported so a page rendering the list can warn when its data hit
 *  it exactly (the one observable signal a plain `.limit()` gives you). */
export const TRANSACTIONS_QUERY_LIMIT = 5000

function invalidateTransactionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
}

export function useMyTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['transactions', 'mine', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(TRANSACTIONS_QUERY_LIMIT)
      if (error) throw error
      return data
    },
  })
}

export function useEveryoneTransactions() {
  return useQuery({
    queryKey: ['transactions', 'everyone'],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(TRANSACTIONS_QUERY_LIMIT)
      if (error) throw error
      return data
    },
  })
}

export const TRANSACTIONS_PAGE_SIZE = 100

async function fetchTransactionsPage(params: {
  pageIndex: number
  /** Restricts to one owner; omitted for the "Everyone" scope (RLS still limits what's visible). */
  ownerUserId?: string
  filters: TransactionFilters
  range: DateRange
}): Promise<Transaction[]> {
  const { pageIndex, ownerUserId, filters, range } = params
  const from = pageIndex * TRANSACTIONS_PAGE_SIZE

  let query = supabase.from('transactions').select('*')
  if (ownerUserId) query = query.eq('owner_user_id', ownerUserId)
  if (filters.ownerId) query = query.eq('owner_user_id', filters.ownerId)
  if (range.start) query = query.gte('date', range.start)
  query = query.lte('date', range.end)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.account) query = query.eq('account', filters.account)
  const searchFilter = buildSearchOrFilter(filters.search)
  if (searchFilter) query = query.or(searchFilter)

  const { data, error } = await query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE - 1)
  if (error) throw error
  return data
}

/**
 * Incrementally-loaded ("Load more") alternative to useMyTransactions, for
 * TransactionsPage's browsable list specifically -- fetches
 * TRANSACTIONS_PAGE_SIZE rows at a time via .range() instead of one flat
 * TRANSACTIONS_QUERY_LIMIT-row fetch, so browsing isn't capped at 5,000.
 * Search, type/category/account/person filters, and the selected period are
 * all applied server-side (see fetchTransactionsPage), so a search reaches
 * the whole history rather than just whatever has been paged in.
 * Deliberately a SEPARATE query from useMyTransactions rather than a
 * replacement for it: budgets, the dashboard, and account-balance math all
 * need the full (still-capped) transaction set for correct sums, and
 * changing what those depend on is out of scope here -- see the
 * TRANSACTIONS_QUERY_LIMIT cap-hit banner on TransactionsPage, which still
 * applies to that full-fetch path exactly as before.
 */
export function useMyTransactionsPaginated(userId: string | null, filters: TransactionFilters, range: DateRange) {
  return useInfiniteQuery({
    queryKey: ['transactions', 'mine-paginated', userId, filters, range],
    enabled: !!userId,
    initialPageParam: 0,
    // Keep the previous results on screen while a new search/filter loads,
    // instead of flashing the skeleton on every change.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => fetchTransactionsPage({ pageIndex: pageParam, ownerUserId: userId!, filters, range }),
    getNextPageParam: (lastPage, allPages) => (lastPage.length === TRANSACTIONS_PAGE_SIZE ? allPages.length : undefined),
  })
}

/** Same as useMyTransactionsPaginated, for the "Everyone" (shared) scope. */
export function useEveryoneTransactionsPaginated(filters: TransactionFilters, range: DateRange) {
  return useInfiniteQuery({
    queryKey: ['transactions', 'everyone-paginated', filters, range],
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => fetchTransactionsPage({ pageIndex: pageParam, filters, range }),
    getNextPageParam: (lastPage, allPages) => (lastPage.length === TRANSACTIONS_PAGE_SIZE ? allPages.length : undefined),
  })
}

export function useAddTransaction() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    /** Resolves to the inserted row, so the caller can act on it right away
     *  (AddEntryModal's Undo toast and optional split need its id). */
    mutationFn: async (
      input: NewTransactionInput & { rules?: SimpleRule[]; allowDuplicate?: boolean }
    ): Promise<Transaction> => {
      if (!userId) throw new Error('Not signed in')

      let category = input.category
      let tags = input.tags
      if (input.rules && input.type !== 'transfer' && category === 'Needs review') {
        const applied = applyRules(input.merchant, category, tags, input.rules)
        category = applied.category
        tags = applied.tags
      }

      const fingerprint = withDuplicateOverride(
        buildFingerprint({
          date: input.date,
          merchant: input.merchant,
          amount: input.amount,
          account: input.account,
        }),
        input.allowDuplicate
      )

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          owner_user_id: userId,
          date: input.date,
          merchant: input.merchant.trim(),
          category,
          amount: input.amount,
          type: input.type,
          account: input.account,
          to_account: input.toAccount ?? null,
          remarks: input.remarks?.trim() || null,
          payment_method: input.paymentMethod ?? null,
          tags,
          receipt: input.receipt,
          receipt_document_id: input.receiptDocumentId ?? null,
          source: 'manual',
          fingerprint,
          ...foreignColumns(input.foreign),
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === DUPLICATE_CODE) {
          throw new DuplicateTransactionError()
        }
        throw error
      }
      return data
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export interface UpdateTransactionInput {
  id: string
  date: string
  merchant: string
  category: string | null
  amount: number
  type: TransactionType
  account: string
  toAccount?: string | null
  remarks?: string | null
  paymentMethod?: PaymentMethod | null
  tags: string[]
  foreign?: ForeignAmount | null
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTransactionInput & { allowDuplicate?: boolean }) => {
      const fingerprint = withDuplicateOverride(
        buildFingerprint({
          date: input.date,
          merchant: input.merchant,
          amount: input.amount,
          account: input.account,
        }),
        input.allowDuplicate
      )

      const { error } = await supabase
        .from('transactions')
        .update({
          date: input.date,
          merchant: input.merchant.trim(),
          category: input.category,
          amount: input.amount,
          type: input.type,
          account: input.account,
          to_account: input.toAccount ?? null,
          remarks: input.remarks?.trim() || null,
          payment_method: input.paymentMethod ?? null,
          tags: input.tags,
          fingerprint,
          ...foreignColumns(input.foreign),
        })
        .eq('id', input.id)

      if (error) {
        if (error.code === DUPLICATE_CODE) {
          throw new DuplicateTransactionError()
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from('transactions').update({ category }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useUpdateTransactionTags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('transactions').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

/** Bulk delete/category-change below both use `.in('id', ids)` -- a single
 *  request each, still scoped correctly by transactions_delete_own/
 *  transactions_update_own RLS per-row regardless of how many ids are
 *  passed, so there's no separate ownership check needed client-side. */
export function useBulkDeleteTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('transactions').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useBulkUpdateTransactionCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, category }: { ids: string[]; category: string }) => {
      const { error } = await supabase.from('transactions').update({ category }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export interface BulkImportRow {
  date: string
  merchant: string
  category: string
  amount: number
  type: TransactionType
  account: string
}

export interface BulkImportResult {
  inserted: number
  duplicates: number
  skipped: number
}

export function useBulkImportTransactions() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      rows: BulkImportRow[]
      skippedDuringParsing: number
      rules: SimpleRule[]
    }): Promise<BulkImportResult> => {
      if (!userId) throw new Error('Not signed in')
      if (input.rows.length === 0) {
        return { inserted: 0, duplicates: 0, skipped: input.skippedDuringParsing }
      }

      const payload = input.rows.map((row) => {
        const applied =
          row.category === 'Needs review' ? applyRules(row.merchant, row.category, [], input.rules) : null
        const category = applied?.category ?? row.category
        return {
          owner_user_id: userId,
          date: row.date,
          merchant: row.merchant.trim(),
          category,
          amount: row.amount,
          type: row.type,
          account: row.account,
          tags: applied?.tags ?? [],
          receipt: false,
          source: 'csv' as const,
          fingerprint: buildFingerprint({
            date: row.date,
            merchant: row.merchant,
            amount: row.amount,
            account: row.account,
          }),
        }
      })

      const { data, error } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'owner_user_id,fingerprint', ignoreDuplicates: true })
        .select('id')

      if (error) throw error

      const inserted = data?.length ?? 0
      return {
        inserted,
        duplicates: payload.length - inserted,
        skipped: input.skippedDuringParsing,
      }
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

/**
 * Each account's balance: its opening balance (Settings -> Starting balances)
 * plus the owner's own transaction history (income adds, expense subtracts, a
 * transfer moves it from `account` to `to_account`). Only as accurate as
 * what's been entered -- not a ground-truth statement about the real account.
 */
export function useAccountBalances(userId: string | null): Map<string, number> {
  const { data: transactions } = useMyTransactions(userId)
  const { data: openingBalances } = useAccountOpeningBalances()
  return useMemo(
    () => calculateAccountBalances(transactions ?? [], openingBalances),
    [transactions, openingBalances]
  )
}

const RECENT_ACCOUNTS_LIMIT = 4

/**
 * The `limit` most recently-used accounts (by the owner's own transaction
 * history), most recent first -- for pinning above the full alphabetical
 * list in an account picker. `useMyTransactions` already orders by
 * date desc/created_at desc, so the first occurrence of each account name
 * while walking that list is already its most recent use.
 */
export function useRecentAccounts(userId: string | null, limit = RECENT_ACCOUNTS_LIMIT): string[] {
  const { data: transactions } = useMyTransactions(userId)
  return useMemo(() => {
    if (!transactions) return []
    const seen = new Set<string>()
    for (const t of transactions) {
      if (seen.size >= limit) break
      seen.add(t.account)
    }
    return Array.from(seen)
  }, [transactions, limit])
}
