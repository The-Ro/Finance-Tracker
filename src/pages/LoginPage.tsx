import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AuthLayout } from '@/components/auth/AuthLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm rounded-card border border-app-border bg-white p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            L
          </div>
          <span className="text-lg font-semibold text-slate-900">LedgeEaze</span>
        </div>
        <h1 className="mb-4 text-base font-semibold text-slate-800">Sign in</h1>
        {/* Explicit tab order: email, password, show/hide toggle, sign in,
            sign up, forgot password last -- "Forgot password?" sits
            visually beside the Password label (reached early in plain DOM
            order) but belongs at the end of the flow, so every focusable
            element here gets a matching tabIndex rather than relying on
            DOM position. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            tabIndex={1}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
              className="absolute right-0 top-0 text-helper font-medium text-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          {error && <InlineMessage tone="error">{error}</InlineMessage>}
          <Button type="submit" disabled={loading} tabIndex={4} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-helper text-slate-500">
          Don't have an account?{' '}
          <Link to="/signup" tabIndex={5} className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
