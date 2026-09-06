import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface ProfileMap {
  [userId: string]: { displayName: string; email: string; avatar: string | null }
}

/** All profiles are readable by any authenticated user (needed to label "everyone's" data). */
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async (): Promise<ProfileMap> => {
      const { data, error } = await supabase.from('profiles').select('id, display_name, email, avatar')
      if (error) throw error
      const map: ProfileMap = {}
      for (const row of data) {
        map[row.id] = { displayName: row.display_name, email: row.email, avatar: row.avatar }
      }
      return map
    },
    staleTime: 60_000,
  })
}
