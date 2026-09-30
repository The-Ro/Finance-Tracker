import { useState } from 'react'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useRules, type Rule } from '@/hooks/useRules'

interface RuleFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Rule | null
}

export function RuleFormModal({ open, onClose, editing }: RuleFormModalProps) {
  const { create, update } = useRules()
  const [whenText, setWhenText] = useState(editing?.when_text ?? '')
  const [thenText, setThenText] = useState(editing?.then_text ?? '')
  const errors = useFieldErrors<'when' | 'then'>()

  const handleSubmit = async () => {
    errors.clear()
    if (!whenText.trim()) return errors.fail('Describe when this rule should apply.', 'when')
    if (!thenText.trim()) return errors.fail('Describe what should happen.', 'then')

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, whenText, thenText })
      } else {
        await create.mutateAsync({ whenText, thenText })
      }
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not save this rule.')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit rule' : 'Create rule'}
      headerActions={<SheetSaveButton onClick={handleSubmit} busy={saving} label="Save rule" />}
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <TextField
          label="When (merchant contains…)"
          placeholder="e.g. starbucks"
          error={errors.on('when')} value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
        />
        <TextField
          label="Then (category and/or tags)"
          placeholder="e.g. category: Dining, tag: coffee"
          error={errors.on('then')} value={thenText}
          onChange={(e) => setThenText(e.target.value)}
        />
        <p className="text-helper text-slate-500">
          Applies only to future CSV imports and new entries left at "Needs review" - never rewrites past
          transactions.
        </p>
      </div>
    </Modal>
  )
}
