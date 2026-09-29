import { useEffect, useState } from 'react'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MonthField } from '@/components/ui/MonthField'
import { QuickAddCategory } from '@/components/ui/QuickAddCategory'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useRecurringMutations, type RecurringItem, type RecurringLoanInput } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { todayISO } from '@/lib/format'
import { emiFor, loanDetailsOf, loanMonthLabel, loanProgress, supportsLoanDetails } from '@/lib/loans'
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
  /** A new item's starting values (setup checklist's bill picks); ignored when editing. */
  prefill?: { name: string; category?: string; loan?: boolean } | null
  /** Shows a delete (trash) in the header when editing; the caller confirms and deletes. */
  onDelete?: () => void
}

/** What a month input gives: YYYY-MM. */
const MONTH_KEY = /^\d{4}-\d{2}$/

/** Loan fields of the form, from an item's stored loan details (strings, as the inputs hold them). */
function loanFormState(item: RecurringItem | null | undefined) {
  const loan = item ? loanDetailsOf(item) : null
  return {
    isLoan: loan !== null,
    loanAmount: loan ? String(loan.amount) : '',
    loanTenure: loan ? String(loan.tenureMonths) : '',
    loanStart: loan?.startMonth ?? '',
    loanRate: loan?.interestRate != null ? String(loan.interestRate) : '',
  }
}

export function RecurringFormModal({ open, onClose, kind, editing, prefill, onDelete }: RecurringFormModalProps) {
  const { format } = useFormatCurrency()
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
  // A prefilled category only if this form offers it (it must be one of the dropdown options).
  const prefillCategory = prefill?.category && categoryOptions.includes(prefill.category) ? prefill.category : undefined

  const [form, setForm] = useState(() => ({
    name: editing?.name ?? prefill?.name ?? '',
    category: editing?.category ?? prefillCategory ?? categoryOptions[0] ?? 'Needs review',
    amount: editing ? String(editing.amount) : '',
    cadence: editing?.cadence ?? ('monthly' as Cadence),
    nextDate: editing?.next_date ?? todayISO(),
    account: editing?.account ?? '',
    ...loanFormState(editing),
    ...(!editing && prefill?.loan ? { isLoan: true } : {}),
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
      ...loanFormState(editing),
      ...(!editing && prefill?.loan ? { isLoan: true } : {}),
    })
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, prefill])

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
    let loan: RecurringLoanInput | null = null
    if (form.isLoan) {
      const loanAmount = Number(form.loanAmount)
      const tenure = Number(form.loanTenure)
      if (!supportsLoanDetails(form.cadence)) return setError('Loan details need a monthly (or longer) cadence.')
      if (!Number.isFinite(loanAmount) || loanAmount <= 0) return setError('Enter the loan amount.')
      if (!Number.isInteger(tenure) || tenure < 1 || tenure > 600) return setError('Enter the tenure in months (1 to 600).')
      if (!MONTH_KEY.test(form.loanStart)) return setError('Choose the month of the first EMI.')
      const rate = form.loanRate.trim() === '' ? null : Number(form.loanRate)
      if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
        return setError('Enter the interest rate as a yearly % between 0 and 100, or leave it empty.')
      }
      loan = { amount: loanAmount, tenureMonths: tenure, startMonth: form.loanStart, interestRate: rate }
    }

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
          loan,
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
          loan,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const saving = addManual.isPending || update.isPending
  // Live "EMI x of y" preview while the loan fields are filled in.
  const preview =
    form.isLoan && Number(form.loanTenure) > 0 && MONTH_KEY.test(form.loanStart) && Number(form.amount) > 0
      ? loanProgress(
          { amount: Number(form.loanAmount) || 0, tenureMonths: Number(form.loanTenure), startMonth: form.loanStart },
          Number(form.amount),
          form.cadence,
          form.nextDate || todayISO()
        )
      : null
  // With amount, rate and tenure filled in, the EMI they imply -- offered as a
  // one-tap fill for the Amount field (a bank's EMI can differ by a rupee or two).
  const suggestedEmi =
    form.isLoan && Number(form.loanAmount) > 0 && form.loanRate.trim() !== '' && Number(form.loanTenure) > 0
      ? emiFor(Number(form.loanAmount), Number(form.loanRate), Number(form.loanTenure))
      : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit' : `Add ${kind === 'subscription' ? 'subscription' : 'recurring payment'}`}
      headerActions={
        <>
          {editing && onDelete && <SheetDeleteButton label={`Delete ${editing.name}`} onClick={onDelete} />}
          <SheetSaveButton onClick={handleSubmit} busy={saving} />
        </>
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
            <QuickAddCategory variant="link" kind="expense" onAdded={(category) => setForm((f) => ({ ...f, category }))} />
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
        {kind === 'recurring' && (
          <div className="flex flex-col gap-3 rounded-xl border border-app-border p-3">
            <label className="flex min-h-[32px] items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={form.isLoan}
                onChange={(e) => setForm((f) => ({ ...f, isLoan: e.target.checked }))}
                className="h-4 w-4"
              />
              This is a loan / EMI
            </label>
            {form.isLoan && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Loan amount"
                    type="number"
                    step="0.01"
                    min="1"
                    value={form.loanAmount}
                    onChange={(e) => setForm((f) => ({ ...f, loanAmount: e.target.value }))}
                  />
                  <TextField
                    label="Tenure (months)"
                    type="number"
                    step="1"
                    min="1"
                    max="600"
                    value={form.loanTenure}
                    onChange={(e) => setForm((f) => ({ ...f, loanTenure: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Interest rate (% a year)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Optional"
                    value={form.loanRate}
                    onChange={(e) => setForm((f) => ({ ...f, loanRate: e.target.value }))}
                  />
                  <MonthField
                    id="recurring-loan-start"
                    label="First EMI (month)"
                    value={form.loanStart}
                    onChange={(loanStart) => setForm((f) => ({ ...f, loanStart }))}
                  />
                </div>
                {suggestedEmi !== null && suggestedEmi > 0 && Math.abs(suggestedEmi - Number(form.amount)) >= 1 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, amount: suggestedEmi.toFixed(2) }))}
                    className="-mx-1 w-fit rounded-md px-1 text-left text-helper font-medium text-accent-dark hover:underline"
                  >
                    EMI at {form.loanRate}% for {form.loanTenure} months ≈ {format(suggestedEmi)} · Use this amount
                  </button>
                )}
                <p className="text-helper text-slate-500">
                  {preview
                    ? `${preview.paid} of ${preview.total} EMIs paid · ends ${loanMonthLabel(preview.endMonth)}${preview.interest > 0 ? ` · about ${format(preview.interest)} interest in all` : ''}`
                    : 'EMIs due before the next date count as paid, so ones you paid before using LedgeEaze are included.'}
                </p>
              </>
            )}
          </div>
        )}
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
