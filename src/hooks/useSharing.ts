import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type ViewerAccessRow = Database['public']['Tables']['viewer_access']['Row']

function invalidateAccess(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['viewer_access'] })
  // Sharing changes write to the bell's history (database triggers).
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

/** Rows where the signed-in user is the owner: requests to approve/decline, plus who they've already approved. */
export function useOwnedAccessRows() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['viewer_access', 'owned', userId],
    enabled: !!userId,
    // A new request comes from someone else's session, with nothing to push
    // it into this one -- poll so the bell's pending count and the incoming
    // requests panel notice it without a manual reload.
    refetchInterval: 30_000,
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

export interface FoundProfile {
  id: string
  label: string
  email: string
  avatar: string | null
}

/**
 * Exact-email lookup (find_profile_by_email RPC) -- the only way to find
 * someone you're not already connected to, since profiles are no longer
 * readable as a directory. Resolves to null when nobody has that exact email.
 */
export function useFindProfileByEmail() {
  return useMutation({
    mutationFn: async (email: string): Promise<FoundProfile | null> => {
      const { data, error } = await supabase.rpc('find_profile_by_email', { p_email: email })
      if (error) throw error
      const row = data?.[0]
      return row ? { id: row.id, label: row.display_name || row.email, email: row.email, avatar: row.avatar } : null
    },
  })
}

/**
 * Requests go through request_viewer_access(email): viewer_access has no
 * insert policy, so a request can't be aimed at a bare user id (which would
 * reveal that person's profile to the requester).
 */
export function useSendAccessRequest() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ownerEmail: string) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.rpc('request_viewer_access', { p_email: ownerEmail })
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

/** Toggles an already-approved grant between 'approved' and 'paused' --
 *  pausing hides your transactions from that person without deleting the
 *  grant itself (unpausing needs no re-request). */
export function useToggleAccessPause() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await supabase
        .from('viewer_access')
        .update({ status: paused ? 'paused' : 'approved' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAccess(queryClient)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
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

/** Friends: add by exact email -- ask to see theirs and, with shareMine, share yours at once (add_friend RPC). */
export function useAddFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, shareMine }: { email: string; shareMine: boolean }) => {
      const { error } = await supabase.rpc('add_friend', { p_email: email, p_share_mine: shareMine })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAccess(queryClient)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

/** Share (on) or pause (off) my entries with someone already connected (set_share_with_friend RPC). */
export function useShareWithFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ friendId, on }: { friendId: string; on: boolean }) => {
      const { error } = await supabase.rpc('set_share_with_friend', { p_friend: friendId, p_on: on })
      if (error) throw error
    },
    onSuccess: () => invalidateAccess(queryClient),
  })
}

/** Remove a friend: both directions of sharing go (remove_friend RPC). Splits stay. */
export function useRemoveFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.rpc('remove_friend', { p_friend: friendId })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAccess(queryClient)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

/** A friend's birthday as 'MM-DD', only when they share it and you're connected (approved either way). */
export function useFriendBirthday(friendId: string | null) {
  return useQuery({
    queryKey: ['friend-birthday', friendId],
    enabled: !!friendId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('friend_birthday', { p_friend: friendId! })
      if (error) throw error
      return (data as string | null) ?? null
    },
  })
}
