import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useBulkDeleteTransactions, type Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatDate } from '@/lib/format'
import { FormError } from '@/components/ui/FieldError'

interface DuplicatesModalProps {
  open: boolean
  onClose: () => void
  /** Groups already filtered of the ones marked "Not a duplicate". */
  groups: Transaction[][]
  onDismiss: (group: Transaction[]) => void
}

const groupKey = (group: Transaction[]) => group.map((t) => t.id).join('|')

/**
 * Reviews groups of possible duplicate transactions (see findDuplicateGroups).
 * Nothing is removed automatically: for each group you either pick the one to
 * keep -- which deletes the rest -- or mark it "Not a duplicate", which is
 * remembered on this device (useDismissedDuplicates) so it doesn't come back.
 */
export function DuplicatesModal({ open, onClose, groups, onDismiss }: DuplicatesModalProps) {
  const [error, setError] = useState<string | null>(null)
  const bulkDelete = useBulkDeleteTransactions()
  const { formatSigned } = useFormatCurrency()

  const visible = groups

  const keepOnly = (group: Transaction[], keep: Transaction) => {
    setError(null)
    bulkDelete.mutate(
      group.filter((t) => t.id !== keep.id).map((t) => t.id),
      { onError: (e) => setError(e instanceof Error ? e.message : 'Could not remove the duplicates.') }
    )
  }

  const handleClose = () => {
    if (bulkDelete.isPending) return
    setError(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Possible duplicates"
      maxWidthClassName="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={bulkDelete.isPending}>
            Done
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-helper text-slate-500">
          Transactions with the same amount and account, within a few days of each other, with a similar
          merchant. Nothing is removed unless you choose which one to keep.
        </p>
        <FormError message={error} />

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={28} className="text-positive" />
            <p className="text-sm font-medium text-slate-800">No possible duplicates</p>
            <p className="text-helper text-slate-500">Nothing in your transactions looks entered twice.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {visible.map((group) => (
              <li key={groupKey(group)} className="rounded-lg border border-app-border">
                <ul>
                  {group.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-app-border px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={t.merchant}>
                          {t.merchant}
                        </p>
                        <p className="text-helper text-slate-500">
                          {formatDate(t.date)} · {t.account}
                          {t.category ? ` · ${t.category}` : ''} · {formatSigned(t.amount, t.type)}
                          {t.source === 'csv' ? ' · imported' : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        className="min-h-[36px] px-3"
                        disabled={bulkDelete.isPending}
                        onClick={() => keepOnly(group, t)}
                      >
                        Keep this one
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end border-t border-app-border bg-slate-50 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onDismiss(group)}
                    className="min-h-[40px] px-1 text-helper font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Not a duplicate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
