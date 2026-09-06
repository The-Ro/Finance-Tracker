import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

function useLookupList(table: 'categories' | 'accounts' | 'tags') {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [table],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from(table).select('name').order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
    staleTime: 30_000,
  })

  const add = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name cannot be empty')
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase
        .from(table)
        .insert({ name: trimmed, created_by: userData.user?.id })
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  })

  return { ...query, add }
}

export const useCategories = () => useLookupList('categories')
export const useAccounts = () => useLookupList('accounts')
export const useTags = () => useLookupList('tags')
