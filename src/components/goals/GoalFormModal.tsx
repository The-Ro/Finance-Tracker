import { useEffect, useState } from 'react'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MoneyField } from '@/components/ui/MoneyField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useGoals, type Goal } from '@/hooks/useGoals'

interface GoalFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Goal | null
  /** Shows a delete (trash) in the header when editing; the caller confirms and deletes. */
  onDelete?: () => void
}

export function GoalFormModal({ open, onClose, editing, onDelete }: GoalFormModalProps) {
  const { create, update } = useGoals()
  const [name, setName] = useState(editing?.name ?? '')
  const [target, setTarget] = useState(editing ? String(editing.target_amount) : '')
  const [current, setCurrent] = useState(editing ? String(editing.current_amount) : '')
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const errors = useFieldErrors<'name' | 'target' | 'current'>()
  const clearErrors = errors.clear

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
    clearErrors()
  }, [open, editing, clearErrors])

  const handleSubmit = async () => {
    errors.clear()
    const targetNum = Number(target)
    const currentNum = current === '' ? 0 : Number(current)
    if (!name.trim()) return errors.fail('Give this goal a name.', 'name')
    if (!Number.isFinite(targetNum) || targetNum <= 0) return errors.fail('Enter a valid target amount.', 'target')
    if (!Number.isFinite(currentNum) || currentNum < 0) return errors.fail('Enter a valid saved amount.', 'current')

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
      errors.fail(e instanceof Error ? e.message : 'Could not save this goal.')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      headerActions={
        <>
          {editing && onDelete && <SheetDeleteButton onClick={onDelete} />}
          <SheetSaveButton onClick={handleSubmit} busy={saving} label="Save goal" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <TextField label="Goal name" error={errors.on('name')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Target amount" error={errors.on('target')} value={target} onChange={setTarget} />
          <MoneyField label="Current saved" error={errors.on('current')} value={current} onChange={setCurrent} />
        </div>
        <TextField label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}
