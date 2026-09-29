import { useState, type FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthError, AuthRise, AuthSubmitButton, AuthSuccess } from '@/components/auth/AuthMotion'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // No account uses that email (account_exists_for_reset): a warning, not a silent "sent".
  const [noAccount, setNoAccount] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Bumped per submit so a repeated, identical error still shakes.
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempt((n) => n + 1)
    setError(null)
    setNoAccount(null)
    setLoading(true)
    const { data: exists, error: checkError } = await supabase.rpc('account_exists_for_reset', { p_email: email.trim() })
    if (!checkError && exists === false) {
      setLoading(false)
      setNoAccount(email.trim())
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
        <AuthSuccess>{`A reset link is on its way to ${email.trim()}. Check your inbox (and spam).`}</AuthSuccess>
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
          {noAccount && (
            <div key={`no-${attempt}`} role="alert" className="animate-shake flex items-start gap-2.5 rounded-lg bg-caution-light px-3 py-2.5 text-helper text-slate-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-caution" aria-hidden="true" />
              <p>
                There’s no LedgeEaze account for <span className="font-semibold text-slate-900">{noAccount}</span>. Check the
                email for typos, or{' '}
                <Link to="/signup" className="font-semibold text-accent-dark hover:underline">
                  create an account
                </Link>
                .
              </p>
            </div>
          )}
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
