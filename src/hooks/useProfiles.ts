import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useOwnedAccessRows, useRequestedAccessRows } from '@/hooks/useSharing'

export interface ProfileMap {
  [userId: string]: { displayName: string; email: string; avatar: string | null; bio?: string | null }
}

/**
 * Profiles are only readable for yourself, the people you share a
 * viewer_access row with (either direction, any status), and -- for the admin
 * -- everyone (see profiles_select_own_or_connected in policies.sql). So the
 * set this returns changes whenever a request is sent/received/removed: the
 * connected ids are part of the query key, which refetches on that change
 * instead of leaving a new connection as "Unknown user" until staleTime runs
 * out. keepPreviousData avoids names flickering away while it refetches.
 */
export function useProfiles() {
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const connections = [
    ...(owned.data ?? []).map((r) => r.requester_user_id),
    ...(requested.data ?? []).map((r) => r.owner_user_id),
  ]
    .sort()
    .join(',')

  return useQuery({
    queryKey: ['profiles', connections],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ProfileMap> => {
      const { data, error } = await supabase.from('profiles').select('id, display_name, email, avatar, bio')
      if (error) throw error
      const map: ProfileMap = {}
      for (const row of data) {
        map[row.id] = { displayName: row.display_name, email: row.email, avatar: row.avatar, bio: row.bio }
      }
      return map
    },
    staleTime: 60_000,
  })
}
