import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

/**
 * Whether the signed-in user is an admin, from the is_admin() RPC (backed by
 * the admin_users table). This only decides what the UI shows -- the RLS
 * policies call the same is_admin() and are what actually enforce access.
 * Admins are granted/revoked only from the SQL editor (see schema.sql);
 * there's intentionally no UI for it.
 */
export function useIsAdmin(): boolean {
  return useAdminStatus().isAdmin
}

/** useIsAdmin plus whether the answer is still loading -- for the /admin route guard. */
export function useAdminStatus(): { isAdmin: boolean; loading: boolean } {
  const { userId } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['is-admin', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data === true
    },
  })
  return { isAdmin: data === true, loading: !!userId && isLoading }
}
