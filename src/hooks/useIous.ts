import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database, IouDirection } from '@/types/database.types'

export type Iou = Database['public']['Tables']['ious']['Row']
export type IouPaymentRow = Database['public']['Tables']['iou_payments']['Row']

/** Lent & borrowed records and their repayments (own-only, see the migration). */
export function useIous() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['ious', userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ records: Iou[]; payments: IouPaymentRow[] }> => {
      const [records, payments] = await Promise.all([
        supabase.from('ious').select('*').eq('owner_user_id', userId!).order('date'),
        supabase.from('iou_payments').select('*').eq('owner_user_id', userId!).order('date'),
      ])
      if (records.error) throw records.error
      if (payments.error) throw payments.error
      return { records: records.data, payments: payments.data }
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ious', userId] })

  const create = useMutation({
    mutationFn: async (input: {
      person: string
      direction: IouDirection
      amount: number
      date: string
      dueDate: string | null
      note: string | null
    }) => {
      const { error } = await supabase.from('ious').insert({
        owner_user_id: userId!,
        person: input.person.trim(),
        direction: input.direction,
        amount: input.amount,
        date: input.date,
        due_date: input.dueDate,
        note: input.note,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (input: {
      id: string
      person: string
      direction: IouDirection
      amount: number
      date: string
      dueDate: string | null
      note: string | null
    }) => {
      const { error } = await supabase
        .from('ious')
        .update({
          person: input.person.trim(),
          direction: input.direction,
          amount: input.amount,
          date: input.date,
          due_date: input.dueDate,
          note: input.note,
        })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ious').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Records a repayment (part or all of what's left). */
  const addPayment = useMutation({
    mutationFn: async (input: { iouId: string; amount: number; date: string }) => {
      const { error } = await supabase.from('iou_payments').insert({
        owner_user_id: userId!,
        iou_id: input.iouId,
        amount: input.amount,
        date: input.date,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('iou_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, create, update, remove, addPayment, removePayment }
}
