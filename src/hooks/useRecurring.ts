import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { detectRecurringCandidates, normalizeMerchant, type RecurringCandidate } from '@/lib/recurringDetection'
import type { Database, RecurringKind } from '@/types/database.types'

export type RecurringItem = Database['public']['Tables']['recurring_items']['Row']

function useRecurringItemsRaw() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['recurring_items', userId],
    enabled: !!userId,
    queryFn: async (): Promise<RecurringItem[]> => {
      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('next_date')
      if (error) throw error
      return data
    },
  })
}

function useDismissedPatterns() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['dismissed_patterns', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('dismissed_patterns')
        .select('pattern_key')
        .eq('owner_user_id', userId!)
      if (error) throw error
      return new Set(data.map((r) => r.pattern_key))
    },
  })
}

export function useRecurringMutations() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring_items', userId] })
    queryClient.invalidateQueries({ queryKey: ['dismissed_patterns', userId] })
  }

  const keep = useMutation({
    mutationFn: async (candidate: RecurringCandidate) => {
      const { error } = await supabase.from('recurring_items').insert({
        owner_user_id: userId!,
        kind: candidate.kind,
        name: candidate.merchant,
        category: candidate.category,
        amount: candidate.averageAmount,
        cadence: candidate.cadence,
        next_date: candidate.nextDate,
      })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const ignore = useMutation({
    mutationFn: async (patternKey: string) => {
      const { error } = await supabase
        .from('dismissed_patterns')
        .insert({ owner_user_id: userId!, pattern_key: patternKey })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const restoreIgnored = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dismissed_patterns').delete().eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const addManual = useMutation({
    mutationFn: async (input: {
      kind: RecurringKind
      name: string
      category: string
      amount: number
      cadence: RecurringItem['cadence']
      nextDate: string
      account?: string | null
    }) => {
      const { error } = await supabase.from('recurring_items').insert({
        owner_user_id: userId!,
        kind: input.kind,
        name: input.name,
        category: input.category,
        amount: input.amount,
        cadence: input.cadence,
        next_date: input.nextDate,
        account: input.account ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const update = useMutation({
    mutationFn: async (input: { id: string } & Partial<{
      name: string
      category: string
      amount: number
      cadence: RecurringItem['cadence']
      next_date: string
      active: boolean
    }>) => {
      const { id, ...rest } = input
      const { error } = await supabase.from('recurring_items').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  return { keep, ignore, restoreIgnored, addManual, update, remove }
}

/**
 * Runs detection over the user's own expense transactions and returns both
 * confirmed items and live suggestions for a given kind, with already-confirmed
 * merchants and dismissed patterns filtered out.
 */
export function useRecurringData(kind: RecurringKind) {
  const { userId } = useAuth()
  const transactionsQuery = useMyTransactions(userId)
  const itemsQuery = useRecurringItemsRaw()
  const dismissedQuery = useDismissedPatterns()

  const confirmed = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => item.kind === kind),
    [itemsQuery.data, kind]
  )

  const suggestions = useMemo(() => {
    if (!transactionsQuery.data || !itemsQuery.data || !dismissedQuery.data) return []
    const expenseTxns = transactionsQuery.data
      .filter((t) => t.type === 'expense')
      .map((t) => ({ date: t.date, merchant: t.merchant, category: t.category ?? '', amount: t.amount, tags: t.tags }))
    const confirmedNormalized = new Set(itemsQuery.data.map((item) => normalizeMerchant(item.name)))
    const all = detectRecurringCandidates(expenseTxns, confirmedNormalized, dismissedQuery.data)
    return all.filter((c) => c.kind === kind)
  }, [transactionsQuery.data, itemsQuery.data, dismissedQuery.data, kind])

  const isLoading = transactionsQuery.isLoading || itemsQuery.isLoading || dismissedQuery.isLoading

  return {
    isLoading,
    confirmed,
    suggestions,
    dismissedCount: dismissedQuery.data?.size ?? 0,
  }
}
