import { useState } from 'react'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!whenText.trim()) return setError('Describe when this rule should apply.')
    if (!thenText.trim()) return setError('Describe what should happen.')

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, whenText, thenText })
      } else {
        await create.mutateAsync({ whenText, thenText })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this rule.')
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
        <TextField
          label="When (merchant contains…)"
          placeholder="e.g. starbucks"
          value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
        />
        <TextField
          label="Then (category and/or tags)"
          placeholder="e.g. category: Dining, tag: coffee"
          value={thenText}
          onChange={(e) => setThenText(e.target.value)}
        />
        <p className="text-helper text-slate-500">
          Applies only to future CSV imports and new entries left at "Needs review" - never rewrites past
          transactions.
        </p>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
