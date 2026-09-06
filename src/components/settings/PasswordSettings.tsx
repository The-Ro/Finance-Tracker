import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { supabase } from '@/lib/supabaseClient'

export function PasswordSettings() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async () => {
    setMessage(null)
    if (newPassword.length < 6) return setMessage({ tone: 'error', text: 'Use at least 6 characters.' })
    if (newPassword !== confirmPassword) return setMessage({ tone: 'error', text: "Passwords don't match." })

    setPending(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPending(false)

    if (error) {
      setMessage({ tone: 'error', text: error.message })
      return
    }
    setMessage({ tone: 'success', text: 'Password updated.' })
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Password</h3>
        <p className="mt-1 text-helper text-slate-500">Change the password you sign in with.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit} disabled={pending} className="self-start">
        {pending ? 'Updating…' : 'Update password'}
      </Button>
      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
    </Card>
  )
}
