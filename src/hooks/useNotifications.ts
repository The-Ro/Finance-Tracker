import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useBudgetAlerts } from '@/hooks/useBudgets'
import { useOverdueRecurringItems } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import { budgetNotice, overdueNotice, salaryNotice } from '@/lib/notifications'
import { SALARY_TAG, salaryPromptDue } from '@/lib/salary'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions } from '@/hooks/useTransactions'
import type { Database } from '@/types/database.types'

export type NotificationRow = Database['public']['Tables']['notifications']['Row']

const HISTORY_LIMIT = 100

/** The bell's history (newest first). Polls: most rows come from other people's actions. */
export function useNotifications() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const key = ['notifications', userId]

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (error) throw error
      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key })

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('owner_user_id', userId!)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Clear (x): hides the note but keeps the row, so its ref stops the same alert being filed again. */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString()
      const { error } = await supabase.from('notifications').update({ dismissed_at: now, read_at: now }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // `data` keeps cleared rows (useFileOwnAlerts needs their refs); `visible` is what the bell shows.
  const visible = (query.data ?? []).filter((n) => !n.dismissed_at)
  const unreadCount = visible.filter((n) => !n.read_at).length
  return { ...query, visible, unreadCount, markRead, markAllRead, remove, invalidate }
}

/**
 * Files the app's own alerts (budget near/over, bill overdue) into the
 * history once each -- `ref` is unique per person, so repeats are ignored.
 * Mounted once, in TopBar.
 */
export function useFileOwnAlerts(existing: readonly NotificationRow[] | undefined, onFiled: () => void) {
  const { userId } = useAuth()
  const budgetAlerts = useBudgetAlerts()
  const overdue = useOverdueRecurringItems()
  const { format } = useFormatCurrency()
  const settings = useUserSettings()
  const { data: transactions } = useMyTransactions(userId)
  const tried = useRef(new Set<string>())

  // Pay day: same rule as Home's SalaryPrompt (from pay day until confirmed,
  // or until an income tagged #salary is logged this month).
  const salary = settings.data?.salary ?? null
  const salaryDue = useMemo(() => {
    if (!salary || !transactions) return null
    const today = todayISO()
    const month = today.slice(0, 7)
    const logged = transactions.some((t) => t.type === 'income' && t.date.startsWith(month) && t.tags.includes(SALARY_TAG))
    return salaryPromptDue(salary, today, logged)
  }, [salary, transactions])

  const notices = useMemo(() => {
    const month = todayISO().slice(0, 7)
    return [
      ...budgetAlerts.map((a) =>
        budgetNotice(
          { budgetId: a.budget.id, category: a.budget.category, spent: a.spent, limit: a.budget.monthly_limit, status: a.status },
          month,
          format
        )
      ),
      ...overdue.map((item) => overdueNotice(item, format, formatShortDate)),
      ...(salaryDue && salary ? [salaryNotice(salaryDue.month, salary.amount, salary.account, format)] : []),
    ]
  }, [budgetAlerts, overdue, format, salaryDue, salary])

  useEffect(() => {
    if (!userId || !existing) return
    const have = new Set(existing.map((n) => n.ref))
    const missing = notices.filter((n) => !have.has(n.ref) && !tried.current.has(n.ref))
    if (missing.length === 0) return
    missing.forEach((n) => tried.current.add(n.ref))
    supabase
      .from('notifications')
      .upsert(
        missing.map((n) => ({ owner_user_id: userId, kind: n.kind, title: n.title, body: n.body, url: n.url, ref: n.ref })),
        { onConflict: 'owner_user_id,ref', ignoreDuplicates: true }
      )
      .then(({ error }) => {
        if (!error) onFiled()
      })
  }, [userId, existing, notices, onFiled])
}
