import { useState } from 'react'
import { KeyRound, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/context/ToastContext'
import { useAdminUserActions } from '@/hooks/useAdmin'
import type { AdminUserRow } from '@/types/database.types'
import { FormError } from '@/components/ui/FieldError'

type Confirm = { kind: 'admin' | 'unadmin' | 'delete' } | null

/**
 * Per-user admin actions on the Admin page: send a password reset email,
 * make or remove an admin, delete the account. The server (admin_* functions)
 * refuses non-admins, keeps at least one admin, won't delete you or another
 * admin, and logs every action.
 */
export function AdminUserActions({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const { setAdmin, deleteUser, sendReset } = useAdminUserActions()
  const { show } = useToast()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const name = user.display_name || user.email

  const close = () => {
    setConfirm(null)
    setTyped('')
    setError(null)
  }

  const reset = () =>
    sendReset.mutate(
      { userId: user.id, email: user.email },
      {
        onSuccess: () => show(`Password reset link sent to ${user.email}.`),
        onError: (e) => show(e instanceof Error ? e.message : 'Could not send the reset link.', { tone: 'error' }),
      }
    )

  const run = async () => {
    setError(null)
    try {
      if (confirm?.kind === 'delete') {
        if (typed.trim().toLowerCase() !== user.email.toLowerCase()) return setError('Type their email exactly to confirm.')
        await deleteUser.mutateAsync(user.id)
        show(`${name}'s account and data were deleted.`)
      } else {
        await setAdmin.mutateAsync({ userId: user.id, admin: confirm?.kind === 'admin' })
        show(confirm?.kind === 'admin' ? `${name} is now an admin.` : `${name} is no longer an admin.`)
      }
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.')
    }
  }

  const chip =
    'press inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-app-border px-3 text-helper font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
  const busy = setAdmin.isPending || deleteUser.isPending

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} disabled={sendReset.isPending} className={chip}>
          <KeyRound size={14} aria-hidden="true" /> {sendReset.isPending ? 'Sending…' : 'Send password reset'}
        </button>
        {user.is_admin ? (
          <button type="button" onClick={() => setConfirm({ kind: 'unadmin' })} className={chip}>
            <ShieldOff size={14} aria-hidden="true" /> Remove admin
          </button>
        ) : (
          <button type="button" onClick={() => setConfirm({ kind: 'admin' })} className={chip}>
            <ShieldCheck size={14} aria-hidden="true" /> Make admin
          </button>
        )}
        {!isSelf && !user.is_admin && (
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'delete' })}
            className={chip + ' border-danger/40 text-danger hover:bg-danger-light'}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete
          </button>
        )}
      </div>

      <Modal
        open={confirm !== null}
        onClose={close}
        title={confirm?.kind === 'delete' ? 'Delete this account?' : confirm?.kind === 'admin' ? 'Make admin?' : 'Remove admin?'}
      >
        <div className="flex flex-col gap-4">
          {confirm?.kind === 'delete' ? (
            <>
              <p className="text-sm text-slate-700">
                This permanently deletes <b>{name}</b> ({user.email}) and everything in their account: entries,
                budgets, goals, bills and sharing. It can’t be undone. Their uploaded files are not removed.
              </p>
              <TextField label="Type their email to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </>
          ) : confirm?.kind === 'admin' ? (
            <p className="text-sm text-slate-700">
              <b>{name}</b> will be able to see every user, read all feedback, post announcements, and use these same
              actions, including deleting accounts. Only do this for someone you trust.
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              <b>{name}</b> will lose access to the Admin page.{isSelf ? ' That includes you.' : ''} There must always be at
              least one admin.
            </p>
          )}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={run} disabled={busy} variant={confirm?.kind === 'delete' ? 'danger' : 'primary'}>
              {busy ? 'Working…' : confirm?.kind === 'delete' ? 'Delete account' : confirm?.kind === 'admin' ? 'Make admin' : 'Remove admin'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
