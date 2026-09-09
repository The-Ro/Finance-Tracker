import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useRecurringMutations, type RecurringItem } from '@/hooks/useRecurring'
import { todayISO } from '@/lib/format'
import type { Cadence, RecurringKind } from '@/types/database.types'

const CADENCES: Cadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'half-yearly', 'annual']

// A subscription is a recurring digital service; a recurring payment is
// everything else recurring (bills, loans, insurance...). Showing every
// built-in expense category (Groceries, Dining, Travel, ...) in both
// pickers made it easy to file a subscription under a category that made no
// sense for it -- each kind now only offers the built-in categories actually
// relevant to it. A category the user made themselves (Settings > Financial
// setup > Expense categories) isn't one of these built-ins, so it always
// stays available in both pickers -- there's no way to know which kind a
// custom category is "for", and hiding it would make it look like it can't
// be used for recurring items at all.
const BUILT_IN_EXPENSE_CATEGORIES = [
  'Housing', 'Utilities', 'Groceries', 'Dining', 'Transportation', 'Shopping', 'Health', 'Insurance',
  'Entertainment', 'Subscriptions', 'Education', 'Travel', 'Personal care', 'Gifts & donations',
  'Fees & charges', 'Other',
]
const SUBSCRIPTION_CATEGORIES = ['Subscriptions', 'Entertainment', 'Education', 'Other']
const RECURRING_CATEGORIES = ['Housing', 'Utilities', 'Insurance', 'Transportation', 'Health', 'Education', 'Fees & charges', 'Other']

interface RecurringFormModalProps {
  open: boolean
  onClose: () => void
  kind: RecurringKind
  editing?: RecurringItem | null
}

export function RecurringFormModal({ open, onClose, kind, editing }: RecurringFormModalProps) {
  // Recurring/subscription detection only ever runs over expense transactions
  // (see useRecurring.ts), so recurring/subscription items are expense-only too.
  const { expense: allExpenseCategories } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { addManual, update } = useRecurringMutations()
  const [error, setError] = useState<string | null>(null)

  const relevant = kind === 'subscription' ? SUBSCRIPTION_CATEGORIES : RECURRING_CATEGORIES
  const categories = allExpenseCategories.filter(
    (c) => relevant.includes(c) || c === editing?.category || !BUILT_IN_EXPENSE_CATEGORIES.includes(c)
  )
  // If the user deleted every relevant default category, fall back to the
  // full list rather than showing an empty dropdown.
  const categoryOptions = categories.length > 0 ? categories : allExpenseCategories

  const [form, setForm] = useState(() => ({
    name: editing?.name ?? '',
    category: editing?.category ?? categoryOptions[0] ?? 'Needs review',
    amount: editing ? String(editing.amount) : '',
    cadence: editing?.cadence ?? ('monthly' as Cadence),
    nextDate: editing?.next_date ?? todayISO(),
    account: editing?.account ?? '',
  }))

  // RecurringFormModal stays mounted across opens (RecurringLikePage just
  // toggles `open`), so the useState initializer above only ever runs once,
  // on first mount. Without this, editing an item shows whatever was left
  // over from the last time the modal was open instead of that item's
  // actual values, and a fresh "Add" can start pre-filled with a stale draft.
  useEffect(() => {
    if (!open) return
    setForm({
      name: editing?.name ?? '',
      category: editing?.category ?? categoryOptions[0] ?? 'Needs review',
      amount: editing ? String(editing.amount) : '',
      cadence: editing?.cadence ?? ('monthly' as Cadence),
      nextDate: editing?.next_date ?? todayISO(),
      account: editing?.account ?? '',
    })
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  useEffect(() => {
    if (!form.account && accounts.length > 0) {
      setForm((f) => ({ ...f, account: accounts[0] }))
    }
  }, [accounts, form.account])

  const handleSubmit = async () => {
    setError(null)
    const amountNum = Number(form.amount)
    if (!form.name.trim()) return setError(`Enter a ${kind === 'subscription' ? 'service' : 'payment'} name.`)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter a valid amount.')
    if (!form.nextDate) return setError('Choose the next date.')
    // Required so "Mark as paid" always has somewhere to log the actual
    // expense transaction against -- see useRecurring.ts's markPaid.
    if (!form.account) return setError('Choose an account.')

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: form.name,
          category: form.category,
          amount: amountNum,
          cadence: form.cadence,
          next_date: form.nextDate,
          account: form.account,
        })
      } else {
        await addManual.mutateAsync({
          kind,
          name: form.name,
          category: form.category,
          amount: amountNum,
          cadence: form.cadence,
          nextDate: form.nextDate,
          account: form.account,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const saving = addManual.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit' : `Add ${kind === 'subscription' ? 'subscription' : 'recurring payment'}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={kind === 'subscription' ? 'Service name' : 'Name'}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Cadence</label>
            <Dropdown
              options={CADENCES}
              value={form.cadence}
              onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Category</label>
            <Dropdown
              options={categoryOptions}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>
          <TextField
            label="Next date"
            type="date"
            value={form.nextDate}
            onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Account</label>
          <Dropdown
            options={accounts}
            value={form.account}
            onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
          />
          <p className="text-helper text-slate-400">Marking this paid logs an expense against this account.</p>
        </div>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
