import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

interface AuthContextValue {
  loading: boolean
  session: Session | null
  user: User | null
  userId: string | null
  email: string | null
  displayName: string
  avatar: string | null
  refreshProfile: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    const email = session?.user?.email
    if (!userId) {
      setDisplayName('')
      setAvatar(null)
      return
    }

    let cancelled = false
    supabase
      .from('profiles')
      .select('display_name, avatar')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        // A failed read (e.g. an access token that expired while the app sat
        // idle, before the refresh landed) keeps what's shown and waits for
        // the refreshed token below -- it used to replace the name with the
        // email and never try again.
        if (error) return
        setDisplayName(data?.display_name ?? email ?? '')
        setAvatar(data?.avatar ?? null)
      })

    return () => {
      cancelled = true
    }
    // The access token is a dependency so a TOKEN_REFRESHED re-reads the profile.
  }, [session?.user?.id, session?.user?.email, session?.access_token, refreshTick])

  const refreshProfile = useCallback(() => setRefreshTick((t) => t + 1), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      displayName: displayName || session?.user?.email || '',
      avatar,
      refreshProfile,
      signOut: async () => {
        // Stop this device's phone reminders first (needs the session to delete it); never block sign-out on it.
        try {
          const { turnOffReminders } = await import('@/lib/push')
          await turnOffReminders()
        } catch {
          // Offline or no service worker: the server drops dead devices on its own.
        }
        await supabase.auth.signOut()
      },
    }),
    [loading, session, displayName, avatar, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
