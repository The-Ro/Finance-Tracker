import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InlineMessage } from '@/components/ui/InlineMessage'
import {
  useEraseMyData,
  useDeleteAccount,
  WIPE_CONFIRMATION_TEXT,
  DELETE_ACCOUNT_CONFIRMATION_TEXT,
} from '@/hooks/useDangerZone'

export function DangerZone() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [done, setDone] = useState(false)
  const [eraseError, setEraseError] = useState<string | null>(null)
  const eraseData = useEraseMyData()

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteAccount = useDeleteAccount()

  // Case-insensitive and whitespace-trimmed: an exact-match confirmation
  // input is notoriously flaky on mobile, where iOS/Android autocapitalize
  // the first letter of what's typed (or autocorrect nudges it) regardless
  // of the ALL-CAPS text shown -- which silently left the button disabled
  // with no visible reason, easy to mistake for "delete isn't working".
  const canConfirm = confirmText.trim().toUpperCase() === WIPE_CONFIRMATION_TEXT
  const canConfirmDelete = deleteConfirmText.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRMATION_TEXT

  const handleErase = async () => {
    setEraseError(null)
    try {
      await eraseData.mutateAsync()
      setDone(true)
      setConfirmText('')
    } catch (err) {
      setEraseError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const handleDelete = async () => {
    setDeleteError(null)
    try {
      await deleteAccount.mutateAsync()
      // On success the session ends and AuthContext redirects to the login screen.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-red-200 bg-red-50/40 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-600" />
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
      </div>
      <p className="text-helper text-slate-600">
        Permanently erase everything in your LedgeEaze account - transactions, budgets, goals, recurring
        items, subscriptions, documents, and rules. Your accounts, categories and starting balances are
        kept. This never affects anyone else's data.
      </p>
      <div>
        <Button variant="danger" onClick={() => setModalOpen(true)}>
          Erase all my data
        </Button>
      </div>

      <div className="mt-1 border-t border-red-200 pt-4">
        <p className="mb-3 text-helper text-slate-600">
          Permanently delete your LedgeEaze account and sign-in - not just your data. This can't be undone,
          and you'd need to sign up again from scratch to use LedgeEaze.
        </p>
        <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
          Delete my account
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setDone(false)
          setConfirmText('')
          setEraseError(null)
        }}
        title="Erase all my data"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {done ? 'Close' : 'Cancel'}
            </Button>
            {!done && (
              <Button variant="danger" disabled={!canConfirm || eraseData.isPending} onClick={handleErase}>
                {eraseData.isPending ? 'Erasing…' : 'Erase everything'}
              </Button>
            )}
          </div>
        }
      >
        {done ? (
          <InlineMessage tone="success">
            Your data has been erased. Your accounts, categories and starting balances are still there -
            change them in Financial setup if you want a completely fresh start.
          </InlineMessage>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              This deletes your transactions, budgets, goals, recurring items, rules, documents and their
              stored files in LedgeEaze. Your accounts, categories and starting balances are kept. It does
              not delete anything from Google Drive or any other service.
            </p>
            <p className="text-sm text-slate-700">
              Type <span className="font-mono font-semibold">{WIPE_CONFIRMATION_TEXT}</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="min-h-[44px] rounded-lg border border-app-border bg-white px-3 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            {eraseError && <InlineMessage tone="error">{eraseError}</InlineMessage>}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteModalOpen}
        onClose={() => {
          if (deleteAccount.isPending) return
          setDeleteModalOpen(false)
          setDeleteConfirmText('')
          setDeleteError(null)
        }}
        title="Delete my account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteAccount.isPending}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!canConfirmDelete || deleteAccount.isPending} onClick={handleDelete}>
              {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            This permanently deletes your LedgeEaze sign-in along with every record tied to it - transactions,
            budgets, goals, recurring items, documents and their stored files, rules, categories, accounts,
            and any sharing connections with other people. There's no way to undo this or recover your data
            afterward.
          </p>
          <p className="text-sm text-slate-700">
            Type <span className="font-mono font-semibold">{DELETE_ACCOUNT_CONFIRMATION_TEXT}</span> to confirm.
          </p>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="min-h-[44px] rounded-lg border border-app-border bg-white px-3 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          {deleteError && <InlineMessage tone="error">{deleteError}</InlineMessage>}
        </div>
      </Modal>
    </Card>
  )
}
