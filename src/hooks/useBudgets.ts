import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { resolvePeriod, isWithinRange } from '@/lib/period'
import type { Database } from '@/types/database.types'

export type Budget = Database['public']['Tables']['budgets']['Row']

export function useBudgets() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['budgets', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['budgets', userId] })

  const create = useMutation({
    mutationFn: async (input: { category: string; monthlyLimit: number }) => {
      const { error } = await supabase.from('budgets').insert({
        owner_user_id: userId!,
        category: input.category,
        monthly_limit: input.monthlyLimit,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (input: { id: string; category?: string; monthlyLimit?: number; active?: boolean }) => {
      const { id, monthlyLimit, ...rest } = input
      const { error } = await supabase
        .from('budgets')
        .update({ ...rest, ...(monthlyLimit !== undefined ? { monthly_limit: monthlyLimit } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, create, update, remove }
}

export interface BudgetAlert {
  budget: Budget
  spent: number
  percent: number
  status: 'approaching' | 'over'
}

/** Active budgets at 90%+ of their limit for the current month. */
export function useBudgetAlerts() {
  const { userId } = useAuth()
  const { data: budgets = [] } = useBudgets()
  const myTransactions = useMyTransactions(userId)

  return useMemo<BudgetAlert[]>(() => {
    const thisMonth = resolvePeriod('this-month')
    const spentByCategory = new Map<string, number>()
    for (const t of myTransactions.data ?? []) {
      if (t.type !== 'expense' || !isWithinRange(t.date, thisMonth)) continue
      spentByCategory.set(t.category, (spentByCategory.get(t.category) ?? 0) + t.amount)
    }

    const alerts: BudgetAlert[] = []
    for (const budget of budgets) {
      if (!budget.active || budget.monthly_limit <= 0) continue
      const spent = spentByCategory.get(budget.category) ?? 0
      const percent = (spent / budget.monthly_limit) * 100
      if (percent >= 100) alerts.push({ budget, spent, percent, status: 'over' })
      else if (percent >= 90) alerts.push({ budget, spent, percent, status: 'approaching' })
    }
    return alerts.sort((a, b) => b.percent - a.percent)
  }, [budgets, myTransactions.data])
}
