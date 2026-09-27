import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthError, AuthRise, AuthSubmitButton, AuthSuccess } from '@/components/auth/AuthMotion'

const HEADLINE = 'Start tracking in minutes.'
const SUPPORTING_TEXT = 'Create your ledger to track spending, split shared expenses, and stay ahead of every bill.'

export function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [loading, setLoading] = useState(false)
  // Bumped per submit so a repeated, identical error still shakes.
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempt((n) => n + 1)
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() || email.split('@')[0] } },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setConfirmationSent(true)
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        headline={HEADLINE}
        supportingText={SUPPORTING_TEXT}
        footer={
          <Link to="/login" className="font-semibold text-accent-dark hover:underline">
            Back to sign in
          </Link>
        }
      >
        <AuthSuccess title="Check your email">
          We sent a confirmation link to <span className="font-medium text-slate-900">{email}</span>. Click it, then
          come back and sign in.
        </AuthSuccess>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      headline={HEADLINE}
      supportingText={SUPPORTING_TEXT}
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent-dark hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthRise index={2}>
          <TextField
            label="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </AuthRise>
        <AuthRise index={3}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthRise>
        <AuthRise index={4}>
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthRise>
        <AuthError key={attempt} message={error} />
        <AuthRise index={5}>
          <AuthSubmitButton loading={loading} loadingLabel="Creating account…">
            Create account
          </AuthSubmitButton>
        </AuthRise>
      </form>
    </AuthLayout>
  )
}
