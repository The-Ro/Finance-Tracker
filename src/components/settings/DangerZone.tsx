import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useEraseMyData, WIPE_CONFIRMATION_TEXT } from '@/hooks/useDangerZone'

export function DangerZone() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [done, setDone] = useState(false)
  const eraseData = useEraseMyData()

  const canConfirm = confirmText === WIPE_CONFIRMATION_TEXT

  const handleErase = async () => {
    await eraseData.mutateAsync()
    setDone(true)
    setConfirmText('')
  }

  return (
    <Card className="flex flex-col gap-3 border-red-200 bg-red-50/40 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-600" />
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
      </div>
      <p className="text-helper text-slate-600">
        Permanently erase everything in your Ledgerly account - transactions, budgets, goals, recurring
        items, subscriptions, documents, and rules. This never affects anyone else's data.
      </p>
      <div>
        <Button variant="danger" onClick={() => setModalOpen(true)}>
          Erase all my data
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setDone(false)
          setConfirmText('')
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
            Your data has been erased. Ledgerly is back to a fresh, empty state for your account.
          </InlineMessage>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              This deletes your database records and stored file copies in Ledgerly. It does not delete
              anything from Google Drive or any other service.
            </p>
            <p className="text-sm text-slate-700">
              Type <span className="font-mono font-semibold">{WIPE_CONFIRMATION_TEXT}</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="min-h-[44px] rounded-lg border border-app-border bg-white px-3 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>
        )}
      </Modal>
    </Card>
  )
}
