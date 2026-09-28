import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDeleteModalProps {
  open: boolean
  title: string
  children: ReactNode
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
}

export function ConfirmDeleteModal({
  open,
  title,
  children,
  pending,
  onCancel,
  onConfirm,
  confirmLabel = 'Delete',
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-slate-700">{children}</div>
    </Modal>
  )
}
