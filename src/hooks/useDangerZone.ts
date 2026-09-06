import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export const WIPE_CONFIRMATION_TEXT = 'DELETE'

/** Erases only the acting user's own data. RLS makes it impossible for this to touch anyone else's rows. */
export function useEraseMyData() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in')

      const folder = `uploads/${userId}`
      const { data: files } = await supabase.storage.from(DOCUMENTS_BUCKET).list(folder)
      if (files && files.length > 0) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove(files.map((f) => `${folder}/${f.name}`))
      }

      const tables = ['documents', 'rules', 'dismissed_patterns', 'recurring_items', 'goals', 'budgets', 'transactions'] as const
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('owner_user_id', userId)
        if (error) throw error
      }

      const { error: settingsError } = await supabase
        .from('user_settings')
        .update({
          assets_total: 0,
          liabilities_total: 0,
          net_worth_configured: false,
          selected_period: 'all-time',
        })
        .eq('owner_user_id', userId)
      if (settingsError) throw settingsError
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
