import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type ViewerAccessRow = Database['public']['Tables']['viewer_access']['Row']

function invalidateAccess(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['viewer_access'] })
}

/** Rows where the signed-in user is the owner: requests to approve/decline, plus who they've already approved. */
export function useOwnedAccessRows() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['viewer_access', 'owned', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ViewerAccessRow[]> => {
      const { data, error } = await supabase
        .from('viewer_access')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Rows where the signed-in user is the requester: their own outgoing requests, pending or approved. */
export function useRequestedAccessRows() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['viewer_access', 'requested', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ViewerAccessRow[]> => {
      const { data, error } = await supabase
        .from('viewer_access')
        .select('*')
        .eq('requester_user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

const DUPLICATE_CODE = '23505'

export function useSendAccessRequest() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ownerUserId: string) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('viewer_access')
        .insert({ requester_user_id: userId, owner_user_id: ownerUserId })
      if (error) {
        if (error.code === DUPLICATE_CODE) {
          throw new Error("You've already requested (or have) access to this person's transactions.")
        }
        throw error
      }
    },
    onSuccess: () => invalidateAccess(queryClient),
  })
}

export function useApproveAccessRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('viewer_access')
        .update({ status: 'approved', responded_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateAccess(queryClient),
  })
}

/** Cancels a pending outgoing request, declines a pending incoming one, or revokes approved access -- same delete either way. */
export function useRemoveAccessRow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('viewer_access').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAccess(queryClient)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
