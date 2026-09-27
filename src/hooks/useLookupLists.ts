import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { CategoryKind } from '@/types/database.types'
import type { AccountDetails } from '@/lib/creditCards'

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
/** Every account's type and credit-card details (kind, limit, statement/due day). */
export function useAccountDetails() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['accounts', userId, 'details'],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, AccountDetails>> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('name, kind, credit_limit, statement_day, due_day')
        .eq('owner_user_id', userId!)
      if (error) throw error
      return new Map(
        data.map((r) => [
          r.name,
          {
            kind: r.kind,
            creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
            statementDay: r.statement_day,
            dueDay: r.due_day,
          },
        ])
      )
    },
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

export const useTags = () => useLookupList('tags')

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
