import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

function useLookupList(table: 'categories' | 'accounts' | 'tags') {
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

  return { ...query, add }
}

export const useCategories = () => useLookupList('categories')
export const useAccounts = () => useLookupList('accounts')
export const useTags = () => useLookupList('tags')
