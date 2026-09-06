import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type Rule = Database['public']['Tables']['rules']['Row']

export function useRules() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['rules', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Rule[]> => {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rules', userId] })

  const create = useMutation({
    mutationFn: async (input: { whenText: string; thenText: string }) => {
      const { error } = await supabase.from('rules').insert({
        owner_user_id: userId!,
        when_text: input.whenText,
        then_text: input.thenText,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (input: { id: string; whenText?: string; thenText?: string; enabled?: boolean }) => {
      const { id, whenText, thenText, ...rest } = input
      const { error } = await supabase
        .from('rules')
        .update({
          ...rest,
          ...(whenText !== undefined ? { when_text: whenText } : {}),
          ...(thenText !== undefined ? { then_text: thenText } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, create, update, remove }
}
