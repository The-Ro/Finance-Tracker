import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { BrandHeader } from '@/components/ui/BrandHeader'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
    <AuthLayout>
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          <BrandHeader tagline />
        </div>
        <h1 className="mb-1 text-base font-semibold text-slate-800">Reset your password</h1>
        <p className="mb-4 text-helper text-slate-500">
          Enter your email and we'll send you a link to set a new password.
        </p>

        {sent ? (
          <InlineMessage tone="success">
            {`If an account exists for ${email}, a reset link is on its way. Check your inbox.`}
          </InlineMessage>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <InlineMessage tone="error">{error}</InlineMessage>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-helper text-slate-500">
          <Link to="/login" className="font-medium text-accent-dark hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </AuthLayout>
  )
}
