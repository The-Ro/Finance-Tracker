import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useOwnedAccessRows, useRequestedAccessRows } from '@/hooks/useSharing'
import type { Database } from '@/types/database.types'
import type { Transaction } from '@/hooks/useTransactions'

export type Split = Database['public']['Tables']['transaction_splits']['Row']

/** Every split I'm part of, as payer or as the person who owes (RLS scopes it). */
export function useSplits() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['transaction_splits', userId],
    enabled: !!userId,
    // The other person adds/settles splits from their own session: poll, like
    // the other cross-user queries (there's no realtime in this app).
    refetchInterval: 30_000,
    queryFn: async (): Promise<Split[]> => {
      const { data, error } = await supabase
        .from('transaction_splits')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return data.map((s) => ({ ...s, amount: Number(s.amount) }))
    },
  })
}

/** User ids I have an approved connection with, in either direction -- the only people I can split with. */
export function useApprovedConnections(): string[] {
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  return useMemo(() => {
    const ids = new Set<string>()
    for (const r of owned.data ?? []) if (r.status === 'approved') ids.add(r.requester_user_id)
    for (const r of requested.data ?? []) if (r.status === 'approved') ids.add(r.owner_user_id)
    return [...ids]
  }, [owned.data, requested.data])
}

export function useSplitMutations() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transaction_splits'] })

  const create = useMutation({
    mutationFn: async (input: { transaction: Transaction; withUserId: string; amount: number }) => {
      const { error } = await supabase.from('transaction_splits').insert({
        transaction_id: input.transaction.id,
        owner_user_id: userId!,
        with_user_id: input.withUserId,
        description: input.transaction.merchant.slice(0, 120),
        date: input.transaction.date,
        amount: input.amount,
      })
      if (error?.code === '23505') throw new Error('This expense is already split with that person.')
      if (error?.code === '42501') throw new Error('You can only split your own expenses with someone you share with.')
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setSettled = useMutation({
    mutationFn: async (input: { id: string; settled: boolean }) => {
      const { error } = await supabase
        .from('transaction_splits')
        .update({ settled_at: input.settled ? new Date().toISOString() : null })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transaction_splits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, setSettled, remove }
}
