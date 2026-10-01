import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { detectRecurringCandidates, normalizeMerchant, type RecurringCandidate } from '@/lib/recurringDetection'
import { todayISO } from '@/lib/format'
import type { Database, RecurringKind } from '@/types/database.types'

export type RecurringItem = Database['public']['Tables']['recurring_items']['Row']

/** Loan / EMI details as the form collects them; startMonth is YYYY-MM. */
export interface RecurringLoanInput {
  amount: number
  tenureMonths: number
  startMonth: string
  /** Annual %, optional. */
  interestRate: number | null
}

/** The three loan columns for an insert/update (all null when it isn't a loan). */
function loanColumns(loan: RecurringLoanInput | null) {
  return loan
    ? {
        loan_amount: loan.amount,
        loan_tenure_months: loan.tenureMonths,
        loan_start_date: `${loan.startMonth}-01`,
        loan_interest_rate: loan.interestRate,
      }
    : { loan_amount: null, loan_tenure_months: null, loan_start_date: null, loan_interest_rate: null }
}

export function useRecurringItemsRaw() {
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
  const { show } = useToast()
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring_items', userId] })
    queryClient.invalidateQueries({ queryKey: ['dismissed_patterns', userId] })
    // A payment linked to a goal adds to it when marked paid.
    queryClient.invalidateQueries({ queryKey: ['goals', userId] })
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
        account: candidate.account,
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
      /** Loan / EMI details -- all three or none (DB check). */
      loan?: RecurringLoanInput | null
      /** A goal each Mark paid adds to (a SIP feeding a goal). */
      goalId?: string | null
      /** A SIP / RD / PPF: Mark paid tags the entry #invest. */
      isInvestment?: boolean
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
        ...loanColumns(input.loan ?? null),
        goal_id: input.goalId ?? null,
        is_investment: input.isInvestment ?? false,
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
      account: string
      /** null clears the loan details; undefined leaves them as they are. */
      loan: RecurringLoanInput | null
      goal_id: string | null
      is_investment: boolean
    }>) => {
      const { id, loan, ...rest } = input
      const { error } = await supabase
        .from('recurring_items')
        .update(loan === undefined ? rest : { ...rest, ...loanColumns(loan) })
        .eq('id', id)
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

  // Nothing advances next_date automatically. This explicit action records
  // the expense and advances its due date in one database transaction, so a
  // network failure cannot leave only one half of the operation completed.
  const markPaid = useMutation({
    mutationFn: async (item: RecurringItem) => {
      if (!item.account) throw new Error('Add an account to this item (Edit) before marking it paid.')

      const { error } = await supabase.rpc('mark_recurring_item_paid', {
        recurring_item_id: item.id,
        paid_on: todayISO(),
      })
      if (error?.code === '23505') throw new Error('Already logged as paid for today.')
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    // Without this, a rejected mutation (e.g. the 23505 duplicate-payment
    // case above) failed completely silently -- no toast, no inline error,
    // nothing -- confirmed by a smoke test clicking "mark paid" twice in a
    // row. The mutation's error was real and correctly prevented bad data,
    // it just never reached the user.
    onError: (error: Error) => {
      show(error.message, { tone: 'error' })
    },
  })

  return { keep, ignore, restoreIgnored, addManual, update, remove, markPaid }
}

/**
 * Active recurring/subscription items past their next_date, across both
 * kinds -- shares `useRecurringItemsRaw`'s query cache (same key) rather
 * than issuing its own fetch, so this stays in sync with whatever the
 * Recurring/Subscriptions pages already loaded.
 */
export function useOverdueRecurringItems(): RecurringItem[] {
  const { data } = useRecurringItemsRaw()
  return useMemo(() => (data ?? []).filter((item) => item.active && item.next_date < todayISO()), [data])
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
      .map((t) => ({ date: t.date, merchant: t.merchant, category: t.category ?? '', amount: t.amount, tags: t.tags, account: t.account }))
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
