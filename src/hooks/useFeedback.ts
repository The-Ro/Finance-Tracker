import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

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
