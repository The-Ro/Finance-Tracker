import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/lib/admin'
import type { AdminErrorGroup, AdminOverview, AdminUserRow, AnnouncementTone, Database } from '@/types/database.types'

export type Announcement = Database['public']['Tables']['app_announcements']['Row']

// Admin dashboard data. Every call goes through an admin_* SECURITY DEFINER
// function that refuses non-admins server-side (the useIsAdmin gate here only
// avoids pointless requests) and returns counts and account info -- never
// anyone's transactions or amounts. No realtime: a minute's staleness is fine.

export function useAdminOverview() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['admin', 'overview'],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOverview> => {
      const { data, error } = await supabase.rpc('admin_overview')
      if (error) throw error
      return data as AdminOverview
    },
  })
}

export function useAdminUsers() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['admin', 'users'],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) throw error
      return (data ?? []) as AdminUserRow[]
    },
  })
}

export function useAdminErrors(days: number) {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['admin', 'errors', days],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminErrorGroup[]> => {
      const { data, error } = await supabase.rpc('admin_client_errors', { p_days: days })
      if (error) throw error
      return (data ?? []) as AdminErrorGroup[]
    },
  })
}

/**
 * Announcements visible to the signed-in user: RLS returns only live ones
 * (active, not past ends_at) to everyone, and every announcement to admins --
 * so the banner filters to live ones itself. Polls, since an admin posts from
 * their own session and nothing pushes it into other open tabs.
 */
export function useAnnouncements() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['announcements'],
    enabled: !!userId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('app_announcements')
        .select('id, message, tone, active, ends_at, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Live = switched on and not past its end time. */
export function isLiveAnnouncement(a: Pick<Announcement, 'active' | 'ends_at'>, now = Date.now()): boolean {
  return a.active && (a.ends_at === null || new Date(a.ends_at).getTime() > now)
}

export function useAnnouncementMutations() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['announcements'] })

  const create = useMutation({
    mutationFn: async (input: { message: string; tone: AnnouncementTone; endsAt: string | null }) => {
      const { error } = await supabase.from('app_announcements').insert({
        message: input.message.trim(),
        tone: input.tone,
        ends_at: input.endsAt,
        created_by: userId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('app_announcements').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('app_announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, setActive, remove }
}

export interface AdminAuditRow {
  created_at: string
  action: 'grant_admin' | 'revoke_admin' | 'delete_user' | 'reset_password'
  admin_email: string | null
  target_email: string | null
}

/** Recent admin actions (admin_audit_log; admins only). */
export function useAdminAuditLog() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['admin', 'audit'],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async (): Promise<AdminAuditRow[]> => {
      const { data, error } = await supabase.rpc('admin_audit_log', { p_limit: 30 })
      if (error) throw error
      return (data ?? []) as AdminAuditRow[]
    },
  })
}

/**
 * Admin actions on a user. Each RPC checks is_admin() server-side and writes
 * the audit log; the reset email itself is sent by Supabase Auth.
 */
export function useAdminUserActions() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['is-admin'] })
  }
  const setAdmin = useMutation({
    mutationFn: async ({ userId, admin }: { userId: string; admin: boolean }) => {
      const { error } = await supabase.rpc(admin ? 'admin_grant_admin' : 'admin_revoke_admin', { p_user: userId })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_delete_user', { p_user: userId })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const sendReset = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      await supabase.rpc('admin_note_reset_sent', { p_user: userId })
    },
    onSuccess: refresh,
  })
  return { setAdmin, deleteUser, sendReset }
}
