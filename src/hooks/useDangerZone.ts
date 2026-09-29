import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { AVATARS_BUCKET, removeFolder } from '@/lib/storageFiles'

export const WIPE_CONFIRMATION_TEXT = 'DELETE'

/**
 * Erases only the acting user's own data. RLS makes it impossible for this to
 * touch anyone else's rows. Accounts, categories, tags, starting balances and
 * the profile are kept (DangerZone's copy says so).
 */
export function useEraseMyData() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in')

      await removeFolder(DOCUMENTS_BUCKET, `uploads/${userId}`)

      const tables = ['documents', 'rules', 'dismissed_patterns', 'recurring_items', 'goals', 'budgets', 'ious', 'transactions'] as const
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

export const DELETE_ACCOUNT_CONFIRMATION_TEXT = 'DELETE MY ACCOUNT'

/**
 * Permanently deletes the signed-in user's auth account. Every owner-scoped
 * table has an `on delete cascade` FK to auth.users, so this also wipes all
 * of that user's data server-side; only stored files need cleaning up first.
 * A storage failure aborts before the account is deleted -- once it's gone,
 * nothing can remove the files any more.
 */
export function useDeleteAccount() {
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in')

      await removeFolder(DOCUMENTS_BUCKET, `uploads/${userId}`)
      await removeFolder(AVATARS_BUCKET, userId)

      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error

      // Local-scope only: a global sign-out calls GoTrue's /logout with a token
      // whose user no longer exists, which can error and leave AuthContext's
      // session never cleared (looks like "delete didn't sign me out"). Local
      // scope just clears the browser's own session, no server round-trip.
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // The account is already deleted regardless of whether this cleanup succeeds.
      }
    },
  })
}
