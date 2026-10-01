import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export function useUpdateProfile() {
  const { userId, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { avatar?: string | null; displayName?: string; bio?: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
          ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
        })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
