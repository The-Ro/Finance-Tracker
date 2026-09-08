import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { TagsField } from './TagsField'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import {
  useAddTransaction,
  useUpdateTransaction,
  useRecentAccounts,
  useAccountBalances,
  type Transaction,
} from '@/hooks/useTransactions'
import { useDocuments } from '@/hooks/useDocuments'
import { useRules } from '@/hooks/useRules'
import { useAuth } from '@/context/AuthContext'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { todayISO } from '@/lib/format'
import type { PaymentMethod, TransactionType } from '@/types/database.types'

const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI', 'Cash', 'Debit card', 'Credit card', 'Net banking', 'Cheque', 'NEFT/RTGS/IMPS', 'Other',
]
const NO_PAYMENT_METHOD = '(none)'

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
  toAccount: '',
  remarks: '',
  paymentMethod: '' as PaymentMethod | '',
  tags: [] as string[],
  hasReceipt: false,
  file: null as File | null,
}

export function AddEntryModal({ open, onClose, transaction }: AddEntryModalProps) {
  const [form, setForm] = useState(EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  const [shakeField, setShakeField] = useState<string | null>(null)
  const [shakeToken, setShakeToken] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const isEditing = !!transaction
  const isTransfer = form.type === 'transfer'

  const { userId } = useAuth()
  const { expense: expenseCategories, income: incomeCategories } = useCategories()
  const categoryOptions = form.type === 'income' ? incomeCategories : expenseCategories
  const { data: accounts = [] } = useAccounts()
  const recentAccounts = useRecentAccounts(userId)
  const accountBalances = useAccountBalances(userId)
  const { format } = useFormatCurrency()
  const { data: rules = [] } = useRules()
  const addTransaction = useAddTransaction()
  const updateTransaction = useUpdateTransaction()
  const documents = useDocuments()

  // Transfer's From/To pickers must exclude each other's current pick --
  // previously only To excluded From; From still listed whatever was
  // already chosen as To, so it looked selectable even though picking it
  // would just get silently reset.
  const toAccountOptions = accounts.filter((a) => a !== form.account)
  const fromAccountOptions = isTransfer ? accounts.filter((a) => a !== form.toAccount) : accounts

  const amountNum = Number(form.amount)

  // Live "does this overdraw the account" hint for transfers. Derived purely
  // from logged transaction history (there's no opening-balance concept in
  // this app), so if we're editing an existing transfer out of this same
  // account, its own old amount has to be added back first -- otherwise the
  // balance already reflects this transfer having happened, double-counting it.
  const fromAccountBalance = useMemo(() => {
    let balance = accountBalances.get(form.account) ?? 0
    if (transaction?.type === 'transfer' && transaction.account === form.account) {
      balance += transaction.amount
    }
    return balance
  }, [accountBalances, form.account, transaction])

  // Same idea as fromAccountBalance, but no overdraw check -- the "To"
  // account is only ever receiving money, so this is purely informational
  // (what does it currently hold, before this transfer lands).
  const toAccountBalance = useMemo(() => {
    let balance = accountBalances.get(form.toAccount) ?? 0
    if (transaction?.type === 'transfer' && transaction.to_account === form.toAccount) {
      balance -= transaction.amount
    }
    return balance
  }, [accountBalances, form.toAccount, transaction])

  useEffect(() => {
    if (!form.account && accounts.length > 0) {
      setForm((f) => ({ ...f, account: accounts[0] }))
    }
  }, [accounts, form.account])

  // Switching Expense <-> Income can leave `category` pointing at a name
  // that isn't in the newly-relevant list (e.g. "Groceries" while on
  // Income) -- fall back to that list's own default instead of silently
  // keeping an option the dropdown no longer offers.
  useEffect(() => {
    if (isTransfer) return
    if (!categoryOptions.includes(form.category)) {
      setForm((f) => ({ ...f, category: categoryOptions[0] ?? 'Needs review' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type])

  useEffect(() => {
    if (isTransfer && !form.toAccount && toAccountOptions.length > 0) {
      setForm((f) => ({ ...f, toAccount: toAccountOptions[0] }))
    }
  }, [isTransfer, form.toAccount, toAccountOptions])

  // A cash account has no "how" -- the payment method fields (UPI/card/net
  // banking/etc.) all describe moving money through a bank, which doesn't
  // apply once the account itself already says "Cash".
  const isCashAccount = form.account === 'Cash'
  useEffect(() => {
    if (isCashAccount && form.paymentMethod) {
      setForm((f) => ({ ...f, paymentMethod: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashAccount])

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
        category: transaction.category ?? 'Needs review',
        account: transaction.account,
        toAccount: transaction.to_account ?? '',
        remarks: transaction.remarks ?? '',
        paymentMethod: transaction.payment_method ?? '',
        tags: transaction.tags,
        hasReceipt: transaction.receipt,
        file: null,
      })
    } else {
      setForm({ ...EMPTY_STATE, category: expenseCategories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  const reset = () => {
    setForm({ ...EMPTY_STATE, category: expenseCategories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    setError(null)
  }

  const handleClose = () => {
    if (addTransaction.isPending || updateTransaction.isPending || documents.upload.isPending) return
    reset()
    onClose()
  }

  // The form scrolls internally and the field a validation error is about
  // (merchant, account, ...) can easily be scrolled out of view by the time
  // someone hits Save -- setting the message alone left it rendered off the
  // bottom of the visible area with no visible sign anything happened.
  // Surfacing it at the very top of the form and scrolling back up there
  // means it's always seen right away, wherever the user was scrolled to.
  //
  // `field` additionally shakes that specific input so it's obvious which
  // one needs attention, not just that *something* does. Shaking works via
  // `key`, not just the class: if the same field fails twice in a row (user
  // hits Save again without changing anything), the class alone wouldn't
  // change and the CSS animation wouldn't restart -- bumping shakeToken
  // into the key forces React to remount that wrapper, restarting it every
  // time.
  const fail = (message: string, field?: string) => {
    setError(message)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    if (field) {
      setShakeField(field)
      setShakeToken((t) => t + 1)
    }
  }
  const shakeKey = (field: string) => (shakeField === field ? `${field}-${shakeToken}` : field)
  const shakeClass = (field: string) => (shakeField === field ? 'animate-shake' : undefined)

  const handleSubmit = async () => {
    setError(null)

    if (!form.merchant.trim()) return fail('Enter a merchant or source.', 'merchant')
    if (!form.date) return fail('Choose a date.', 'date')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return fail('Enter a valid amount greater than zero.', 'amount')
    if (!form.account) return fail('Choose an account.', 'account')
    if (isTransfer && !form.toAccount) return fail('Choose an account to transfer to.', 'toAccount')
    if (isTransfer && form.toAccount === form.account) return fail('Choose a different account to transfer to.', 'toAccount')
    if (!isEditing && form.hasReceipt && !form.file) return fail('Choose a receipt file, or uncheck the receipt box.', 'file')

    const category = isTransfer ? null : form.category
    const toAccount = isTransfer ? form.toAccount : null
    const paymentMethod = form.paymentMethod || null

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          type: form.type,
          amount: amountNum,
          merchant: form.merchant,
          date: form.date,
          category,
          account: form.account,
          toAccount,
          remarks: form.remarks,
          paymentMethod,
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
          category,
          account: form.account,
          toAccount,
          remarks: form.remarks,
          paymentMethod,
          tags: form.tags,
          receipt: form.hasReceipt,
          receiptDocumentId,
          rules: rules.map((r) => ({ whenText: r.when_text, thenText: r.then_text, enabled: r.enabled })),
        })
      }

      reset()
      onClose()
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong saving this entry.')
    }
  }

  const saving = addTransaction.isPending || updateTransaction.isPending || documents.upload.isPending

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Edit entry' : 'Add entry'}
      contentRef={contentRef}
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
        {error && <InlineMessage tone="error">{error}</InlineMessage>}

        <div className="flex rounded-lg border border-app-border p-1">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
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
          <div key={shakeKey('amount')} className={shakeClass('amount')}>
            <TextField
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div key={shakeKey('date')} className={shakeClass('date')}>
            <TextField
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>

        <div key={shakeKey('merchant')} className={shakeClass('merchant')}>
          <TextField
            label="Merchant or source"
            placeholder="e.g. Trader Joe's"
            maxLength={60}
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div key={shakeKey('account')} className={clsx('flex flex-col gap-1.5', shakeClass('account'))}>
            <label className="text-helper font-medium text-slate-600">{isTransfer ? 'From account' : 'Account'}</label>
            <Dropdown
              options={fromAccountOptions}
              recentOptions={recentAccounts}
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value, toAccount: '' }))}
            />
            {isTransfer && form.account && (
              <p className={clsx('text-helper', amountNum > fromAccountBalance ? 'font-medium text-caution' : 'text-slate-400')}>
                {amountNum > fromAccountBalance
                  ? `Only ${format(fromAccountBalance)} available in ${form.account}`
                  : `${format(fromAccountBalance)} available in ${form.account}`}
              </p>
            )}
          </div>
          {isTransfer ? (
            <div key={shakeKey('toAccount')} className={clsx('flex flex-col gap-1.5', shakeClass('toAccount'))}>
              <label className="text-helper font-medium text-slate-600">To account</label>
              <Dropdown
                options={toAccountOptions.length > 0 ? toAccountOptions : ['No other accounts yet']}
                recentOptions={recentAccounts}
                value={form.toAccount || 'No other accounts yet'}
                onChange={(e) => setForm((f) => ({ ...f, toAccount: e.target.value }))}
                disabled={toAccountOptions.length === 0}
              />
              {form.toAccount && (
                <p className="text-helper text-slate-400">{format(toAccountBalance)} available in {form.toAccount}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-helper font-medium text-slate-600">Category</label>
              <Dropdown
                options={categoryOptions}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Payment method</label>
            <Dropdown
              options={[NO_PAYMENT_METHOD, ...PAYMENT_METHODS]}
              value={isCashAccount ? NO_PAYMENT_METHOD : form.paymentMethod || NO_PAYMENT_METHOD}
              disabled={isCashAccount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  paymentMethod: e.target.value === NO_PAYMENT_METHOD ? '' : (e.target.value as PaymentMethod),
                }))
              }
            />
          </div>
          <TextField
            label="Remarks"
            placeholder="Add a note"
            maxLength={200}
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
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
            key={shakeKey('file')}
            type="file"
            accept="image/*,.pdf,.csv,.xls,.xlsx"
            onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
            className={clsx('text-sm', shakeClass('file'))}
          />
        )}
      </div>
    </Modal>
  )
}
