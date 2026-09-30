import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabaseClient'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'

export function PasswordSettings() {
  const { show } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const errors = useFieldErrors<'newPassword' | 'confirmPassword'>()
  const [pending, setPending] = useState(false)

  const handleSubmit = async () => {
    errors.clear()
    if (newPassword.length < 6) return errors.fail('Use at least 6 characters.', 'newPassword')
    if (newPassword !== confirmPassword) return errors.fail("Passwords don't match.", 'confirmPassword')

    setPending(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setPending(false)

    if (updateError) {
      errors.fail(updateError.message)
      return
    }
    show('Password updated.')
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
          error={errors.on('newPassword')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.on('confirmPassword')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit} disabled={pending} className="self-start">
        {pending ? 'Updating…' : 'Update password'}
      </Button>
      <FormError message={errors.general} />
    </Card>
  )
}
