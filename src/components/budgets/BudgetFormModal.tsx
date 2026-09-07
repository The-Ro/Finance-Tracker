import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useCategories } from '@/hooks/useLookupLists'
import { useBudgets, type Budget } from '@/hooks/useBudgets'

interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Budget | null
}

export function BudgetFormModal({ open, onClose, editing }: BudgetFormModalProps) {
  // Budgets are always an expense concept (a monthly spend limit) -- only
  // ever matched against expense transactions in useBudgetAlerts.
  const { expense: categories } = useCategories()
  const { create, update } = useBudgets()
  const [category, setCategory] = useState(editing?.category ?? '')
  const [limit, setLimit] = useState(editing ? String(editing.monthly_limit) : '')
  const [error, setError] = useState<string | null>(null)

  // BudgetFormModal stays mounted across opens (BudgetsPage just toggles
  // `open`), so the useState initializers above only ever run once, on first
  // mount. Without this, editing a budget shows whatever was left over from
  // the last time the modal was open instead of that budget's actual values,
  // and a fresh "Create budget" can start pre-filled with a stale draft.
  useEffect(() => {
    if (!open) return
    setCategory(editing?.category ?? '')
    setLimit(editing ? String(editing.monthly_limit) : '')
    setError(null)
  }, [open, editing])

  useEffect(() => {
    if (!category && categories.length > 0) setCategory(categories[0])
  }, [category, categories])

  const handleSubmit = async () => {
    setError(null)
    const limitNum = Number(limit)
    if (!category) return setError('Choose a category.')
    if (!Number.isFinite(limitNum) || limitNum < 0) return setError('Enter a valid monthly limit.')

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, category, monthlyLimit: limitNum })
      } else {
        await create.mutateAsync({ category, monthlyLimit: limitNum })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this budget.')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'Create budget'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save budget'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Category</label>
          <Dropdown options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <TextField label="Monthly limit" type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
