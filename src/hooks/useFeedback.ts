import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { ADMIN_EMAIL } from '@/lib/admin'
import type { Database } from '@/types/database.types'

export type FeedbackRow = Database['public']['Tables']['feedback']['Row']

export function useSendFeedback() {
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed) throw new Error('Write something before sending.')
      const { error } = await supabase.from('feedback').insert({ owner_user_id: userId!, message: trimmed })
      if (error) throw error
    },
  })
}

/** Every submission, for the admin inbox -- feedback_select_admin (RLS)
 *  is what actually restricts this to the one hardcoded admin; the email
 *  check here just avoids firing the query for everyone else, who'd get
 *  their own feedback back (via feedback_select_own) rather than an error. */
export function useAdminFeedbackInbox() {
  const { email } = useAuth()
  const isAdmin = email === ADMIN_EMAIL

  return useQuery({
    queryKey: ['feedback', 'admin-inbox'],
    enabled: isAdmin,
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSendFeedbackReply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const trimmed = reply.trim()
      if (!trimmed) throw new Error('Write a reply before sending.')
      const { error } = await supabase
        .from('feedback')
        .update({ admin_reply: trimmed, replied_at: new Date().toISOString(), reply_seen_at: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  })
}

/** The signed-in user's own feedback that has a reply they haven't
 *  dismissed yet -- this is what powers their notification badge. */
export function useMyFeedbackReplies() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['feedback', 'my-replies', userId],
    enabled: !!userId,
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('owner_user_id', userId!)
        .not('admin_reply', 'is', null)
        .is('reply_seen_at', null)
        .order('replied_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useMarkFeedbackReplySeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase.rpc('mark_feedback_reply_seen', { feedback_id: feedbackId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  })
}
