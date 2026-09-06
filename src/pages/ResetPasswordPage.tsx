import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AuthLayout } from '@/components/auth/AuthLayout'

// Reached only via the link in a password-recovery email. Supabase's client
// detects the recovery token in the URL and establishes a session before this
// mounts, which is why this route sits outside both ProtectedRoute (no normal
// session may exist yet) and PublicOnlyRoute (a session may already exist).
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setReady(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('Use at least 6 characters.')
    if (password !== confirmPassword) return setError("Passwords don't match.")

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm rounded-card border border-app-border bg-white p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            L
          </div>
          <span className="text-lg font-semibold text-slate-900">Ledgerly</span>
        </div>
        <h1 className="mb-4 text-base font-semibold text-slate-800">Set a new password</h1>

        {!ready ? (
          <p className="text-helper text-slate-500">Loading…</p>
        ) : done ? (
          <InlineMessage tone="success">Password updated. Taking you to your dashboard…</InlineMessage>
        ) : !hasSession ? (
          <>
            <InlineMessage tone="error">This reset link is invalid or has expired.</InlineMessage>
            <p className="mt-4 text-center text-helper text-slate-500">
              <Link to="/forgot-password" className="font-medium text-accent hover:underline">
                Request a new link
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <InlineMessage tone="error">{error}</InlineMessage>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
