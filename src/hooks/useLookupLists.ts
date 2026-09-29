import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { CardNetwork, CategoryKind } from '@/types/database.types'
import { DEFAULT_ACCOUNT_KIND, normalizeAccountKind, type AccountDetails } from '@/lib/creditCards'

function useLookupList(table: 'accounts' | 'tags') {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [table, userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from(table)
        .select('name')
        .eq('owner_user_id', userId!)
        .order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
    staleTime: 30_000,
  })

  const add = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name cannot be empty')
      const { error } = await supabase
        .from(table)
        .insert({ name: trimmed, owner_user_id: userId!, created_by: userId })
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table, userId] }),
  })

  const FK_VIOLATION = '23503'
  const remove = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from(table).delete().eq('owner_user_id', userId!).eq('name', name)
      if (error) {
        if (error.code === FK_VIOLATION) {
          throw new Error("Can't delete — it's still used by existing transactions.")
        }
        throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table, userId] }),
  })

  return { ...query, add, remove }
}

export const useAccounts = () => useLookupList('accounts')

/**
 * Deletes several accounts in one request -- onboarding's bank step removes the
 * seeded banks the user didn't pick. Only pass accounts nothing uses (see
 * isUntouchedSeededBank): one referenced by a transaction fails the whole delete.
 */
export function useRemoveAccounts() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (names: string[]) => {
      if (names.length === 0) return
      const { error } = await supabase.from('accounts').delete().eq('owner_user_id', userId!).in('name', names)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', userId] }),
  })
}

/**
 * Each account's opening balance (accounts.opening_balance). Keyed under
 * ['accounts', userId] so the existing add/remove invalidation refreshes it too.
 */
export function useAccountOpeningBalances() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['accounts', userId, 'opening-balances'],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('name, opening_balance')
        .eq('owner_user_id', userId!)
      if (error) throw error
      return new Map(data.map((r) => [r.name, Number(r.opening_balance)]))
    },
    staleTime: 30_000,
  })
}

/** accounts.created_by per name: null for the banks seeded at signup, the user's id for accounts they added. */
export function useAccountCreatedBy() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['accounts', userId, 'created-by'],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, string | null>> => {
      const { data, error } = await supabase.from('accounts').select('name, created_by').eq('owner_user_id', userId!)
      if (error) throw error
      return new Map(data.map((r) => [r.name, r.created_by]))
    },
    staleTime: 30_000,
  })
}

/** Sets one of the caller's own accounts' opening balance (narrow RPC -- there's
 *  no UPDATE policy on accounts, so names can't be changed from the client). */
export function useSetAccountOpeningBalance() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ account, amount }: { account: string; amount: number }) => {
      const { error } = await supabase.rpc('set_account_opening_balance', { p_account: account, p_amount: amount })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', userId] }),
  })
}
/**
 * Runs on every read, cached ones included: a cache restored from before a
 * kind was renamed (1.7.0's 'bank' -> 'savings') still comes out valid.
 * Module-level so TanStack keeps the result stable between renders.
 */
function withKnownKinds(details: Map<string, AccountDetails>): Map<string, AccountDetails> {
  if ([...details.values()].every((d) => normalizeAccountKind(d.kind) === d.kind)) return details
  return new Map([...details].map(([name, d]) => [name, { ...d, kind: normalizeAccountKind(d.kind) }]))
}

/** Every account's type and credit-card details (kind, limit, statement/due day). */
export function useAccountDetails() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['accounts', userId, 'details'],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, AccountDetails>> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('name, kind, credit_limit, statement_day, due_day, closed_at, card_network')
        .eq('owner_user_id', userId!)
      if (error) throw error
      return new Map(
        data.map((r) => [
          r.name,
          {
            kind: normalizeAccountKind(r.kind),
            creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
            statementDay: r.statement_day,
            dueDay: r.due_day,
            closed: r.closed_at != null,
            network: r.card_network ?? null,
          },
        ])
      )
    },
    select: withKnownKinds,
    staleTime: 30_000,
  })
}

/** Sets one of the caller's own accounts' type and card details (narrow RPC, like the opening balance). */
export function useSetAccountDetails() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ account, details }: { account: string; details: AccountDetails }) => {
      const { error } = await supabase.rpc('set_account_details', {
        p_account: account,
        p_kind: details.kind,
        p_credit_limit: details.creditLimit,
        p_statement_day: details.statementDay,
        p_due_day: details.dueDay,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', userId] }),
  })
}

/** Close or reopen one of the caller's own accounts (narrow RPC). */
/** Sets a credit card's network (narrow RPC; null clears it). */
export function useSetCardNetwork() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ account, network }: { account: string; network: CardNetwork | null }) => {
      const { error } = await supabase.rpc('set_card_network', { p_account: account, p_network: network })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', userId] }),
  })
}

export function useSetAccountClosed() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ account, closed }: { account: string; closed: boolean }) => {
      const { error } = await supabase.rpc('set_account_closed', { p_account: account, p_closed: closed })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', userId] })
      queryClient.invalidateQueries({ queryKey: ['debit_cards'] })
    },
  })
}

/**
 * Adds an account and sets it up in one go: kind + card details (only when not
 * the default savings account) and opening balance (only when non-zero), via
 * the same narrow RPCs as editing. `opening` uses the stored sign -- for a
 * credit card pass owedToOpening(owed).
 */
export function useAddAccount() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, details, opening = 0 }: { name: string; details: AccountDetails; opening?: number }) => {
      if (!userId) throw new Error('Not signed in')
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name cannot be empty')
      const { error } = await supabase.from('accounts').insert({ name: trimmed, owner_user_id: userId, created_by: userId })
      if (error) {
        if (error.code === '23505') throw new Error('You already have an account with that name.')
        throw error
      }
      const hasDetails =
        details.kind !== DEFAULT_ACCOUNT_KIND || details.creditLimit != null || details.statementDay != null || details.dueDay != null
      if (hasDetails) {
        const { error: detailsError } = await supabase.rpc('set_account_details', {
          p_account: trimmed,
          p_kind: details.kind,
          p_credit_limit: details.creditLimit,
          p_statement_day: details.statementDay,
          p_due_day: details.dueDay,
        })
        if (detailsError) throw detailsError
      }
      if (opening !== 0) {
        const { error: openingError } = await supabase.rpc('set_account_opening_balance', { p_account: trimmed, p_amount: opening })
        if (openingError) throw openingError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', userId] }),
  })
}

export const useTags = () => useLookupList('tags')

/**
 * Moves everything filed under one category to another (Settings -> Categories):
 * the user's transactions and recurring items, and its budget when the target
 * has none yet (a category can only have one). Own rows only (RLS). Returns
 * how many transactions moved.
 */
export function useMoveCategory() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }): Promise<number> => {
      if (!userId) throw new Error('Not signed in')
      if (from === to) return 0
      const { error, count } = await supabase
        .from('transactions')
        .update({ category: to }, { count: 'exact' })
        .eq('owner_user_id', userId)
        .eq('category', from)
      if (error) throw error
      const { error: recurringError } = await supabase
        .from('recurring_items')
        .update({ category: to })
        .eq('owner_user_id', userId)
        .eq('category', from)
      if (recurringError) throw recurringError
      const { data: targetBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('owner_user_id', userId)
        .eq('category', to)
        .maybeSingle()
      if (!targetBudget) {
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({ category: to })
          .eq('owner_user_id', userId)
          .eq('category', from)
        if (budgetError) throw budgetError
      }
      return count ?? 0
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['recurring_items', userId] })
      queryClient.invalidateQueries({ queryKey: ['budgets', userId] })
    },
  })
}

/**
 * Deletes a tag everywhere: from the user's tag list and from every one of
 * their transactions (delete_tag RPC, one statement under their own RLS).
 */
export function useDeleteTag() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tag: string) => {
      const { error } = await supabase.rpc('delete_tag', { p_tag: tag })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', userId] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

interface CategoryRow {
  name: string
  kind: CategoryKind | null
}

/**
 * Categories are split into expense/income lists (a `kind` column), unlike
 * accounts/tags -- so this isn't just `useLookupList('categories')`. `data`
 * stays a flat `string[]` of every name (matching the old shape, for callers
 * like the Transactions filter that intentionally want everything regardless
 * of kind); `expense`/`income` are each that type's picks *plus* any
 * kind-less category (legacy/"Needs review") so shared categories keep
 * showing in both pickers instead of disappearing from one.
 */
export function useCategories() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['categories', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('name, kind')
        .eq('owner_user_id', userId!)
        .order('name')
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })

  const rows = query.data ?? []
  const data = rows.map((r) => r.name)
  const expense = rows.filter((r) => r.kind !== 'income').map((r) => r.name)
  const income = rows.filter((r) => r.kind !== 'expense').map((r) => r.name)

  const add = useMutation({
    mutationFn: async ({ name, kind }: { name: string; kind?: CategoryKind | null }) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name cannot be empty')
      const { error } = await supabase
        .from('categories')
        .insert({ name: trimmed, owner_user_id: userId!, created_by: userId, kind: kind ?? null })
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', userId] }),
  })

  const FK_VIOLATION = '23503'
  const remove = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('categories').delete().eq('owner_user_id', userId!).eq('name', name)
      if (error) {
        if (error.code === FK_VIOLATION) {
          throw new Error("Can't delete — it's still used by existing transactions.")
        }
        throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', userId] }),
  })

  return { ...query, data, expense, income, add, remove }
}
