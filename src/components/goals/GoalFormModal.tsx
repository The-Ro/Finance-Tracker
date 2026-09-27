import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useGoals, type Goal } from '@/hooks/useGoals'

interface GoalFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Goal | null
}

export function GoalFormModal({ open, onClose, editing }: GoalFormModalProps) {
  const { create, update } = useGoals()
  const [name, setName] = useState(editing?.name ?? '')
  const [target, setTarget] = useState(editing ? String(editing.target_amount) : '')
  const [current, setCurrent] = useState(editing ? String(editing.current_amount) : '')
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  // GoalFormModal stays mounted across opens (GoalsPage just toggles `open`),
  // so the useState initializers above only ever run once, on first mount.
  // Without this, editing a goal shows whatever was left over from the last
  // time the modal was open instead of that goal's actual values, and a
  // fresh "New goal" can start pre-filled with a stale draft.
  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setTarget(editing ? String(editing.target_amount) : '')
    setCurrent(editing ? String(editing.current_amount) : '')
    setDueDate(editing?.due_date ?? '')
    setNote(editing?.note ?? '')
    setError(null)
  }, [open, editing])

  const handleSubmit = async () => {
    setError(null)
    const targetNum = Number(target)
    const currentNum = current === '' ? 0 : Number(current)
    if (!name.trim()) return setError('Give this goal a name.')
    if (!Number.isFinite(targetNum) || targetNum <= 0) return setError('Enter a valid target amount.')
    if (!Number.isFinite(currentNum) || currentNum < 0) return setError('Enter a valid saved amount.')

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name,
          targetAmount: targetNum,
          currentAmount: currentNum,
          dueDate: dueDate || null,
          note: note || null,
        })
      } else {
        await create.mutateAsync({
          name,
          targetAmount: targetNum,
          currentAmount: currentNum,
          dueDate: dueDate || null,
          note: note || null,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this goal.')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save goal'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Target amount" type="number" step="0.01" min="0.01" value={target} onChange={(e) => setTarget(e.target.value)} />
          <TextField label="Current saved" type="number" step="0.01" min="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <TextField label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
