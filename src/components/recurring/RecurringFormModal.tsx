import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useRecurringMutations, type RecurringItem } from '@/hooks/useRecurring'
import { todayISO } from '@/lib/format'
import type { Cadence, RecurringKind } from '@/types/database.types'

const CADENCES: Cadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']

interface RecurringFormModalProps {
  open: boolean
  onClose: () => void
  kind: RecurringKind
  editing?: RecurringItem | null
}

export function RecurringFormModal({ open, onClose, kind, editing }: RecurringFormModalProps) {
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { addManual, update } = useRecurringMutations()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState(() => ({
    name: editing?.name ?? '',
    category: editing?.category ?? categories[0] ?? 'Needs review',
    amount: editing ? String(editing.amount) : '',
    cadence: editing?.cadence ?? ('monthly' as Cadence),
    nextDate: editing?.next_date ?? todayISO(),
    account: editing?.account ?? '',
  }))

  const handleSubmit = async () => {
    setError(null)
    const amountNum = Number(form.amount)
    if (!form.name.trim()) return setError(`Enter a ${kind === 'subscription' ? 'service' : 'payment'} name.`)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter a valid amount.')
    if (!form.nextDate) return setError('Choose the next date.')

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: form.name,
          category: form.category,
          amount: amountNum,
          cadence: form.cadence,
          next_date: form.nextDate,
        })
      } else {
        await addManual.mutateAsync({
          kind,
          name: form.name,
          category: form.category,
          amount: amountNum,
          cadence: form.cadence,
          nextDate: form.nextDate,
          account: form.account || null,
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
              options={categories}
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
        {!editing && (
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Account (optional)</label>
            <Dropdown
              options={['(none)', ...accounts]}
              value={form.account || '(none)'}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value === '(none)' ? '' : e.target.value }))}
            />
          </div>
        )}
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
