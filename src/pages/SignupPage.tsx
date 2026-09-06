import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AuthLayout } from '@/components/auth/AuthLayout'

export function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
      <AuthLayout>
        <div className="w-full max-w-sm rounded-card border border-app-border bg-white p-6 text-center shadow-card">
          <h1 className="mb-2 text-base font-semibold text-slate-800">Check your email</h1>
          <p className="text-sm text-slate-600">
            We sent a confirmation link to <span className="font-medium">{email}</span>. Click it, then come
            back and sign in.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
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
        <h1 className="mb-4 text-base font-semibold text-slate-800">Create your account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField label="Display name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <InlineMessage tone="error">{error}</InlineMessage>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-helper text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
