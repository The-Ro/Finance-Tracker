import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type Goal = Database['public']['Tables']['goals']['Row']

export function useGoals() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['goals', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['goals', userId] })

  const create = useMutation({
    mutationFn: async (input: {
      name: string
      targetAmount: number
      currentAmount: number
      dueDate?: string | null
      note?: string | null
    }) => {
      const { error } = await supabase.from('goals').insert({
        owner_user_id: userId!,
        name: input.name,
        target_amount: input.targetAmount,
        current_amount: input.currentAmount,
        due_date: input.dueDate ?? null,
        note: input.note ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      targetAmount?: number
      currentAmount?: number
      dueDate?: string | null
      note?: string | null
    }) => {
      const { id, targetAmount, currentAmount, dueDate, ...rest } = input
      const { error } = await supabase
        .from('goals')
        .update({
          ...rest,
          ...(targetAmount !== undefined ? { target_amount: targetAmount } : {}),
          ...(currentAmount !== undefined ? { current_amount: currentAmount } : {}),
          ...(dueDate !== undefined ? { due_date: dueDate } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, create, update, remove }
}
