import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthError, AuthRise, AuthSubmitButton } from '@/components/auth/AuthMotion'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Bumped per submit so a repeated, identical error still shakes.
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempt((n) => n + 1)
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <AuthLayout
      headline="Every rupee, in one clear ledger."
      supportingText="Track spending, split shared expenses, and stay ahead of every bill."
      title="Welcome back"
      subtitle="Sign in to continue to your ledger."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/signup" tabIndex={5} className="font-semibold text-accent-dark hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {/* Explicit tab order: email, password, show/hide toggle, sign in,
          sign up, forgot password last -- "Forgot password?" sits visually
          beside the Password label (reached early in plain DOM order) but
          belongs at the end of the flow, so every focusable element here
          gets a matching tabIndex rather than relying on DOM position. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthRise index={2}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            tabIndex={1}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthRise>
        <AuthRise index={3}>
          <div className="relative flex flex-col gap-1.5">
            <label htmlFor="password" className="text-helper font-medium text-slate-600">
              Password
            </label>
            <TextField
              id="password"
              type="password"
              autoComplete="current-password"
              required
              tabIndex={2}
              toggleTabIndex={3}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Link
              to="/forgot-password"
              tabIndex={6}
              className="absolute right-0 top-0 text-helper font-medium text-accent-dark hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </AuthRise>
        <AuthError key={attempt} message={error} />
        <AuthRise index={4}>
          <AuthSubmitButton loading={loading} loadingLabel="Signing in…" tabIndex={4}>
            Sign in
          </AuthSubmitButton>
        </AuthRise>
      </form>
    </AuthLayout>
  )
}
