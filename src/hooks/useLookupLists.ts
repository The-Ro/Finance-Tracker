import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { CategoryKind } from '@/types/database.types'

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
