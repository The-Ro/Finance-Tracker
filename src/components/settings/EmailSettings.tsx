import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export function EmailSettings() {
  const { email } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async () => {
    setMessage(null)
    const trimmed = newEmail.trim()
    if (!trimmed) return setMessage({ tone: 'error', text: 'Enter a new email address.' })
    if (trimmed === email) return setMessage({ tone: 'error', text: 'That\'s already your current email.' })

    setPending(true)
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setPending(false)

    if (error) {
      setMessage({ tone: 'error', text: error.message })
      return
    }
    setMessage({
      tone: 'success',
      text: `Confirmation links sent to ${email} and ${trimmed}. The change takes effect once you confirm.`,
    })
    setNewEmail('')
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Email</h3>
        <p className="mt-1 text-helper text-slate-500">Current: {email}</p>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="New email address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? 'Sending…' : 'Change email'}
        </Button>
      </div>
      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
      <p className="text-helper text-slate-400">
        You'll need to confirm the change from a link sent to your new address before it takes effect.
      </p>
    </Card>
  )
}
