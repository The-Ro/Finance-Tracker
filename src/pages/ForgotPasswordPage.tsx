import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthError, AuthRise, AuthSubmitButton, AuthSuccess } from '@/components/auth/AuthMotion'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  // Bumped per submit so a repeated, identical error still shakes.
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempt((n) => n + 1)
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      headline="Every rupee, in one clear ledger."
      supportingText="Track spending, split shared expenses, and stay ahead of every bill."
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new password."
      footer={
        <Link to="/login" className="font-semibold text-accent-dark hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <AuthSuccess>{`If an account exists for ${email}, a reset link is on its way. Check your inbox.`}</AuthSuccess>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthRise index={2}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </AuthRise>
          <AuthError key={attempt} message={error} />
          <AuthRise index={3}>
            <AuthSubmitButton loading={loading} loadingLabel="Sending…">
              Send reset link
            </AuthSubmitButton>
          </AuthRise>
        </form>
      )}
    </AuthLayout>
  )
}
