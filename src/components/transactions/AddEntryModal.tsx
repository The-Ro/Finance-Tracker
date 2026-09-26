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
  useMyTransactions,
  DuplicateTransactionError,
  type Transaction,
} from '@/hooks/useTransactions'
import { useDocuments } from '@/hooks/useDocuments'
import { useRules } from '@/hooks/useRules'
import { suggestCategory } from '@/lib/smartCategory'
import { useAuth } from '@/context/AuthContext'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatDate, todayISO } from '@/lib/format'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { convertToHome, fetchFxRate } from '@/lib/fx'
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
  /** '' = the user's home currency. */
  currency: '',
  fxRate: '',
}

const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code)

export function AddEntryModal({ open, onClose, transaction }: AddEntryModalProps) {
  const [form, setForm] = useState(EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  // Set when the last save attempt was rejected as a duplicate -- offers a
  // "Save anyway" retry instead of just leaving the user stuck, since the
  // fingerprint check can't tell a real duplicate from two distinct
  // transactions that happen to share date/merchant/amount/account (see
  // DuplicateTransactionError in useTransactions.ts).
  const [duplicatePending, setDuplicatePending] = useState(false)
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
  const { data: myTransactions } = useMyTransactions(userId)
  // Smart category: offered (never auto-applied) from the user's own past
  // entries at a similar merchant, for new entries only.
  const suggestedCategory = useMemo(() => {
    if (isEditing || isTransfer || !myTransactions) return null
    const s = suggestCategory(form.merchant, form.type, myTransactions)
    return s && s !== form.category && categoryOptions.includes(s) ? s : null
  }, [isEditing, isTransfer, myTransactions, form.merchant, form.type, form.category, categoryOptions])
  const { format, currency: homeCurrency } = useFormatCurrency()
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

  // Foreign-currency entry (expense/income only): the typed amount is in
  // form.currency and gets converted to the home currency at the rate below,
  // fixed at entry time -- see src/lib/fx.ts.
  const isForeign = !isTransfer && !!form.currency && form.currency !== homeCurrency
  const rateNum = Number(form.fxRate)
  const homeAmount = isForeign ? convertToHome(amountNum, rateNum) : amountNum
  const [rateStatus, setRateStatus] = useState<{ state: 'idle' | 'loading' | 'error'; asOf?: string }>({ state: 'idle' })
  // Set when prefilling an existing foreign entry, so opening it for edit keeps
  // its stored rate instead of silently re-fetching one.
  const keepStoredRate = useRef(false)

  useEffect(() => {
    if (!open || !isForeign || !form.date) return
    if (keepStoredRate.current) {
      keepStoredRate.current = false
      return
    }
    const controller = new AbortController()
    setRateStatus({ state: 'loading' })
    fetchFxRate(form.currency, homeCurrency, form.date, controller.signal)
      .then(({ rate, date }) => {
        setForm((f) => ({ ...f, fxRate: String(rate) }))
        setRateStatus({ state: 'idle', asOf: date })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setRateStatus({ state: 'error' })
      })
    return () => controller.abort()
  }, [open, isForeign, form.currency, form.date, homeCurrency])

  // Live "does this overdraw the account" hint for transfers. Derived from the
  // account's opening balance plus logged transaction history, so if we're
  // editing an existing transfer out of this same account, its own old amount
  // has to be added back first -- otherwise the balance already reflects this
  // transfer having happened, double-counting it.
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
        currency: transaction.original_currency ?? '',
        fxRate: transaction.fx_rate != null ? String(transaction.fx_rate) : '',
        ...(transaction.original_amount != null ? { amount: String(transaction.original_amount) } : {}),
      })
      keepStoredRate.current = transaction.original_currency != null
    } else {
      setForm({ ...EMPTY_STATE, category: expenseCategories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    }
    setError(null)
    setDuplicatePending(false)
    setRateStatus({ state: 'idle' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  const reset = () => {
    setForm({ ...EMPTY_STATE, category: expenseCategories[0] ?? 'Needs review', account: accounts[0] ?? '' })
    setError(null)
    setDuplicatePending(false)
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

  const handleSubmit = async (opts?: { allowDuplicate?: boolean }) => {
    setError(null)
    if (!opts?.allowDuplicate) setDuplicatePending(false)

    if (!form.merchant.trim()) return fail('Enter a merchant or source.', 'merchant')
    if (!form.date) return fail('Choose a date.', 'date')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return fail('Enter a valid amount greater than zero.', 'amount')
    if (!form.account) return fail('Choose an account.', 'account')
    if (isTransfer && !form.toAccount) return fail('Choose an account to transfer to.', 'toAccount')
    if (isTransfer && form.toAccount === form.account) return fail('Choose a different account to transfer to.', 'toAccount')
    if (!isEditing && form.hasReceipt && !form.file) return fail('Choose a receipt file, or uncheck the receipt box.', 'file')
    if (isForeign && (!Number.isFinite(rateNum) || rateNum <= 0)) {
      return fail(`Enter the exchange rate from ${form.currency} to ${homeCurrency}.`, 'fxRate')
    }
    if (isForeign && homeAmount <= 0) return fail('That converts to less than 0.01. Check the amount and rate.', 'amount')

    const foreign = isForeign ? { currency: form.currency, amount: amountNum, rate: rateNum } : null

    const category = isTransfer ? null : form.category
    const toAccount = isTransfer ? form.toAccount : null
    const paymentMethod = form.paymentMethod || null

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          type: form.type,
          amount: homeAmount,
          merchant: form.merchant,
          date: form.date,
          category,
          account: form.account,
          toAccount,
          remarks: form.remarks,
          paymentMethod,
          tags: form.tags,
          foreign,
          allowDuplicate: opts?.allowDuplicate,
        })
      } else {
        let receiptDocumentId: string | null = null
        if (form.hasReceipt && form.file) {
          const doc = await documents.upload.mutateAsync(form.file)
          receiptDocumentId = doc.id
        }

        await addTransaction.mutateAsync({
          type: form.type,
          amount: homeAmount,
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
          foreign,
          allowDuplicate: opts?.allowDuplicate,
        })
      }

      reset()
      onClose()
    } catch (e) {
      if (e instanceof DuplicateTransactionError) {
        setDuplicatePending(true)
        fail(e.message)
      } else {
        fail(e instanceof Error ? e.message : 'Something went wrong saving this entry.')
      }
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
          {duplicatePending && (
            <Button variant="secondary" onClick={() => handleSubmit({ allowDuplicate: true })} disabled={saving}>
              Save anyway
            </Button>
          )}
          <Button onClick={() => handleSubmit()} disabled={saving}>
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
              onClick={() => setForm((f) => ({ ...f, type: t, ...(t === 'transfer' ? { currency: '', fxRate: '' } : {}) }))}
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
              label={isForeign ? `Amount (${form.currency})` : 'Amount'}
              type="number"
              min="0.01"
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

        {!isTransfer && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-helper font-medium text-slate-600">Currency</label>
                <Dropdown
                  options={CURRENCY_CODES}
                  value={form.currency || homeCurrency}
                  aria-label="Currency"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value === homeCurrency ? '' : e.target.value, fxRate: '' }))
                  }
                />
              </div>
              {isForeign && (
                <div key={shakeKey('fxRate')} className={shakeClass('fxRate')}>
                  <TextField
                    label={`1 ${form.currency} = ? ${homeCurrency}`}
                    type="number"
                    min="0"
                    step="any"
                    placeholder={rateStatus.state === 'loading' ? 'Looking up…' : 'Rate'}
                    value={form.fxRate}
                    onChange={(e) => setForm((f) => ({ ...f, fxRate: e.target.value }))}
                  />
                </div>
              )}
            </div>
            {isForeign && (
              <p
                className={clsx(
                  'text-helper',
                  rateStatus.state === 'error' && !(homeAmount > 0) ? 'text-caution' : 'text-slate-500'
                )}
              >
                {Number.isFinite(homeAmount) && homeAmount > 0
                  ? `Saved as ${format(homeAmount)}${
                      rateStatus.state !== 'error' && rateStatus.asOf
                        ? ` (ECB rate for ${formatDate(rateStatus.asOf)}, editable)`
                        : ''
                    }`
                  : rateStatus.state === 'error'
                    ? "Couldn't look up a rate. Type the one you were charged."
                    : rateStatus.state === 'loading'
                      ? 'Looking up the exchange rate…'
                      : 'Enter the amount and rate to see the converted value.'}
              </p>
            )}
          </div>
        )}

        <div key={shakeKey('merchant')} className={shakeClass('merchant')}>
          <TextField
            label="Merchant or source"
            placeholder="e.g. Trader Joe's"
            maxLength={60}
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
          />
          {suggestedCategory && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, category: suggestedCategory }))}
              className="animate-fade-in mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-accent-light px-3 text-helper font-medium text-accent-on-light"
            >
              Use {suggestedCategory}, like last time
            </button>
          )}
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
              <span id="entry-category-label" className="text-helper font-medium text-slate-600">
                Category
              </span>
              {/* Chips rather than a dropdown: one tap, and every option (custom ones
                  included -- categoryOptions is the full list) is visible at once. */}
              <div
                role="group"
                aria-labelledby="entry-category-label"
                className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto"
              >
                {categoryOptions.map((option) => {
                  const selected = form.category === option
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm((f) => ({ ...f, category: option }))}
                      className={
                        'min-h-[36px] rounded-full border px-3 text-helper font-medium transition-colors active:scale-95 ' +
                        (selected
                          ? 'border-accent bg-accent-light text-accent-on-light'
                          : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark')
                      }
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
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
