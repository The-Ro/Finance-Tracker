import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthError, AuthRise, AuthSpinner, AuthSubmitButton, AuthSuccess } from '@/components/auth/AuthMotion'

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
  // Bumped per submit so a repeated, identical error still shakes.
  const [attempt, setAttempt] = useState(0)

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
    setAttempt((n) => n + 1)
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
    <AuthLayout
      headline="Every rupee, in one clear ledger."
      supportingText="Track spending, split shared expenses, and stay ahead of every bill."
      title="Set a new password"
      subtitle="Choose a password with at least 6 characters."
    >
      {!ready ? (
        <p className="flex items-center gap-2 text-helper text-slate-500">
          <AuthSpinner />
          Loading…
        </p>
      ) : done ? (
        <AuthSuccess>Password updated. Taking you to your dashboard…</AuthSuccess>
      ) : !hasSession ? (
        <>
          <InlineMessage tone="error">This reset link is invalid or has expired.</InlineMessage>
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link to="/forgot-password" className="font-semibold text-accent-dark hover:underline">
              Request a new link
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthRise index={2}>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </AuthRise>
          <AuthRise index={3}>
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </AuthRise>
          <AuthError key={attempt} message={error} />
          <AuthRise index={4}>
            <AuthSubmitButton loading={loading} loadingLabel="Updating…">
              Update password
            </AuthSubmitButton>
          </AuthRise>
        </form>
      )}
    </AuthLayout>
  )
}
