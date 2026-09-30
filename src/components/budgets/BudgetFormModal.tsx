import { useEffect, useState } from 'react'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { QuickAddCategory } from '@/components/ui/QuickAddCategory'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useCategories } from '@/hooks/useLookupLists'
import { useBudgets, type Budget } from '@/hooks/useBudgets'

interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Budget | null
  /** Shows a delete (trash) in the header when editing; the caller confirms and deletes. */
  onDelete?: () => void
}

export function BudgetFormModal({ open, onClose, editing, onDelete }: BudgetFormModalProps) {
  // Budgets are always an expense concept (a monthly spend limit) -- only
  // ever matched against expense transactions in useBudgetAlerts.
  const { expense: categories } = useCategories()
  const { create, update } = useBudgets()
  const [category, setCategory] = useState(editing?.category ?? '')
  const [limit, setLimit] = useState(editing ? String(editing.monthly_limit) : '')
  const [rollover, setRollover] = useState(editing?.rollover ?? false)
  const errors = useFieldErrors<'category' | 'limit'>()
  const clearErrors = errors.clear

  // BudgetFormModal stays mounted across opens (BudgetsPage just toggles
  // `open`), so the useState initializers above only ever run once, on first
  // mount. Without this, editing a budget shows whatever was left over from
  // the last time the modal was open instead of that budget's actual values,
  // and a fresh "Create budget" can start pre-filled with a stale draft.
  useEffect(() => {
    if (!open) return
    setCategory(editing?.category ?? '')
    setLimit(editing ? String(editing.monthly_limit) : '')
    setRollover(editing?.rollover ?? false)
    clearErrors()
  }, [open, editing, clearErrors])

  useEffect(() => {
    if (!category && categories.length > 0) setCategory(categories[0])
  }, [category, categories])

  const handleSubmit = async () => {
    errors.clear()
    // Number('') is 0, so a blank field has to be rejected explicitly.
    const limitNum = limit.trim() === '' ? NaN : Number(limit)
    if (!category) return errors.fail('Choose a category.', 'category')
    if (!Number.isFinite(limitNum) || limitNum <= 0) return errors.fail('Enter a monthly limit greater than zero.', 'limit')

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, category, monthlyLimit: limitNum, rollover })
      } else {
        await create.mutateAsync({ category, monthlyLimit: limitNum, rollover })
      }
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not save this budget.')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'Create budget'}
      headerActions={
        <>
          {editing && onDelete && <SheetDeleteButton onClick={onDelete} />}
          <SheetSaveButton onClick={handleSubmit} busy={saving} label="Save budget" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Category</label>
          <Dropdown options={categories} error={errors.on('category')} value={category} onChange={(e) => setCategory(e.target.value)} />
          <QuickAddCategory variant="link" kind="expense" onAdded={setCategory} />
        </div>
        <TextField label="Monthly limit" type="number" step="0.01" min="0" error={errors.on('limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
          />
          <span>
            Roll over what's left
            <span className="block text-helper text-slate-500">
              Unspent money from last month is added to this month's limit. Overspending is never carried.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  )
}
