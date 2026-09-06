import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { TagsField } from './TagsField'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useAddTransaction, useUpdateTransaction, type Transaction } from '@/hooks/useTransactions'
import { useDocuments } from '@/hooks/useDocuments'
import { useRules } from '@/hooks/useRules'
import { todayISO } from '@/lib/format'
import type { TransactionType } from '@/types/database.types'

interface AddEntryModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

const EMPTY_STATE = {
  type: 'expense' as TransactionType,
  amount: '',
  merchant: '',
  date: todayISO(),
  category: 'Needs review',
  account: '',
  tags: [] as string[],
  hasReceipt: false,
  file: null as File | null,
}

export function AddEntryModal({ open, onClose, transaction }: AddEntryModalProps) {
  const [form, setForm] = useState(EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!transaction

  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { data: rules = [] } = useRules()
  const addTransaction = useAddTransaction()
  const updateTransaction = useUpdateTransaction()
  const documents = useDocuments()

  useEffect(() => {
    if (!form.account && accounts.length > 0) {
      setForm((f) => ({ ...f, account: accounts[0] }))
    }
  }, [accounts, form.account])

  // Prefill from the transaction being edited (or reset to a blank form)
  // each time the modal opens -- not on every render, so typing doesn't
  // fight this effect.
  useEffect(() => {
    if (!open) return
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: String(transaction.amount),
        merchant: transaction.merchant,
        date: transaction.date,
        category: transaction.category,
        account: transaction.account,
        tags: transaction.tags,
        hasReceipt: transaction.receipt,
        file: null,
      })
    } else {
      setForm({ ...EMPTY_STATE, category: categories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  const reset = () => {
    setForm({ ...EMPTY_STATE, category: categories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    setError(null)
  }

  const handleClose = () => {
    if (addTransaction.isPending || updateTransaction.isPending || documents.upload.isPending) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    const amountNum = Number(form.amount)

    if (!form.merchant.trim()) return setError('Enter a merchant or source.')
    if (!form.date) return setError('Choose a date.')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter a valid amount greater than zero.')
    if (!form.account) return setError('Choose an account.')
    if (!isEditing && form.hasReceipt && !form.file) return setError('Choose a receipt file, or uncheck the receipt box.')

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          type: form.type,
          amount: amountNum,
          merchant: form.merchant,
          date: form.date,
          category: form.category,
          account: form.account,
          tags: form.tags,
        })
      } else {
        let receiptDocumentId: string | null = null
        if (form.hasReceipt && form.file) {
          const doc = await documents.upload.mutateAsync(form.file)
          receiptDocumentId = doc.id
        }

        await addTransaction.mutateAsync({
          type: form.type,
          amount: amountNum,
          merchant: form.merchant,
          date: form.date,
          category: form.category,
          account: form.account,
          tags: form.tags,
          receipt: form.hasReceipt,
          receiptDocumentId,
          rules: rules.map((r) => ({ whenText: r.when_text, thenText: r.then_text, enabled: r.enabled })),
        })
      }

      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving this entry.')
    }
  }

  const saving = addTransaction.isPending || updateTransaction.isPending || documents.upload.isPending

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Edit entry' : 'Add entry'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save entry'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex rounded-lg border border-app-border p-1">
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={clsx(
                'flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors',
                form.type === t ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        <TextField
          label="Merchant or source"
          placeholder="e.g. Trader Joe's"
          maxLength={60}
          value={form.merchant}
          onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Category</label>
            <Dropdown
              options={categories}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Account</label>
            <Dropdown
              options={accounts}
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
            />
          </div>
        </div>

        <TagsField selected={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />

        {!isEditing && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.hasReceipt}
              onChange={(e) => setForm((f) => ({ ...f, hasReceipt: e.target.checked, file: null }))}
              className="h-4 w-4 rounded border-app-border"
            />
            I have a receipt to attach
          </label>
        )}

        {!isEditing && form.hasReceipt && (
          <input
            type="file"
            accept="image/*,.pdf,.csv,.xls,.xlsx"
            onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
            className="text-sm"
          />
        )}

        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
