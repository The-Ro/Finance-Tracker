import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type MoneyReminder = Database['public']['Tables']['money_reminders']['Row']

export interface MoneyReminderInput {
  title: string
  amount: number | null
  dueDate: string
  note: string | null
  /** Log the entry when "Sent" is tapped (needs account and amount). */
  logEntry: boolean
  account: string | null
  paymentMethod: string | null
  category: string | null
}

/**
 * "Remind me to send money": own-only one-off reminders (migration
 * 2026-09-30_reminders_private_rows_today.sql). The daily 9 AM run files a
 * bell note (and so a phone note) on the due day; nothing here moves money.
 */
export function useMoneyReminders() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['money_reminders', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MoneyReminder[]> => {
      const { data, error } = await supabase
        .from('money_reminders')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('due_date')
      if (error) throw error
      return data ?? []
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['money_reminders', userId] })
  const row = (input: MoneyReminderInput) => ({
    title: input.title.trim(),
    amount: input.amount,
    due_date: input.dueDate,
    note: input.note?.trim() || null,
    log_entry: input.logEntry,
    account: input.logEntry ? input.account : null,
    payment_method: input.logEntry ? input.paymentMethod || null : null,
    category: input.logEntry ? input.category || null : null,
  })

  const create = useMutation({
    mutationFn: async (input: MoneyReminderInput) => {
      const { error } = await supabase.from('money_reminders').insert({ owner_user_id: userId!, ...row(input) })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: MoneyReminderInput & { id: string }) => {
      const { error } = await supabase.from('money_reminders').update(row(input)).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('money_reminders')
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('money_reminders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, create, update, setDone, remove }
}
