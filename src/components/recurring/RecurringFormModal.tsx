import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useAccountKinds } from '@/hooks/useCards'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MoneyField } from '@/components/ui/MoneyField'
import { MonthField } from '@/components/ui/MonthField'
import { QuickAddCategory } from '@/components/ui/QuickAddCategory'
import { Dropdown } from '@/components/ui/Dropdown'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useCategories, useAccounts, useAccountDetails, useSetCardPayFrom } from '@/hooks/useLookupLists'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useGoals } from '@/hooks/useGoals'
import { useAddTransaction } from '@/hooks/useTransactions'
import { useToast } from '@/context/ToastContext'
import { nextStatementDate } from '@/lib/creditCards'
import { useRecurringMutations, type RecurringItem, type RecurringLoanInput } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
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
  prefill?: { name: string; category?: string; loan?: boolean; goalId?: string } | null
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

/** "st", "nd", "rd" or "th" for a day of the month. */
function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}

export function RecurringFormModal({ open, onClose, kind, editing, prefill, onDelete }: RecurringFormModalProps) {
  const { format } = useFormatCurrency()
  // Recurring/subscription detection only ever runs over expense transactions
  // (see useRecurring.ts), so recurring/subscription items are expense-only too.
  const { expense: allExpenseCategories } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const kinds = useAccountKinds()
  // A loan's EMI is either added to a credit card bill or taken from a bank
  // account; picking one narrows the account list (null = follow the account).
  const [emiBy, setEmiBy] = useState<'card' | 'bank' | null>(null)
  // SIP / savings: each Mark paid also adds to this goal.
  const { data: goals = [] } = useGoals()
  const [goalId, setGoalId] = useState<string>('')
  const { addManual, update } = useRecurringMutations()
  const errors = useFieldErrors<'name' | 'amount' | 'nextDate' | 'account' | 'cadence' | 'loanAmount' | 'loanTenure' | 'loanStart' | 'loanRate'>()

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
      name: editing?.name ?? prefill?.name ?? '',
      category: editing?.category ?? prefillCategory ?? categoryOptions[0] ?? 'Needs review',
      amount: editing ? String(editing.amount) : '',
      cadence: editing?.cadence ?? ('monthly' as Cadence),
      nextDate: editing?.next_date ?? todayISO(),
      account: editing?.account ?? '',
      ...loanFormState(editing),
      ...(!editing && prefill?.loan ? { isLoan: true } : {}),
    })
    setEmiBy(null)
    setProcessingFee('')
    setGoalId(editing?.goal_id ?? prefill?.goalId ?? '')
    errors.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, prefill])

  const isCard = (a: string) => kinds.get(a) === 'credit_card'
  const paidBy = emiBy ?? (isCard(form.account) ? 'card' : 'bank')
  // With a loan, only cards (EMI on the card bill) or only non-cards (from the bank).
  const accountOptions = form.isLoan ? accounts.filter((a) => (paidBy === 'card' ? isCard(a) : !isCard(a))) : accounts
  const choosePaidBy = (by: 'card' | 'bank') => {
    setEmiBy(by)
    setForm((f) => (isCard(f.account) === (by === 'card') ? f : { ...f, account: '' }))
  }

  // A blank account takes the first one that fits (a card for a card EMI).
  const firstOption = accountOptions[0]
  useEffect(() => {
    if (!form.account && firstOption) {
      setForm((f) => ({ ...f, account: firstOption }))
    }
  }, [firstOption, form.account])

  // Card EMIs: billed on the card's statement date, and the card's bill is
  // paid from a bank account (saved on the card, used to pre-fill "Pay").
  const { data: accountDetails } = useAccountDetails()
  const { inUse } = useAccountsInUse()
  const setCardPayFrom = useSetCardPayFrom()
  const addTransaction = useAddTransaction()
  const { show } = useToast()
  const cardEmi = form.isLoan && paidBy === 'card' && isCard(form.account)
  const card = cardEmi ? accountDetails?.get(form.account) : undefined
  const [payFrom, setPayFrom] = useState('')
  const [processingFee, setProcessingFee] = useState('')
  useEffect(() => {
    setPayFrom(card?.payFrom ?? '')
  }, [form.account, card?.payFrom])
  const payFromOptions = useMemo(
    () => ['', ...[...inUse].filter((a) => !isCard(a) && !accountDetails?.get(a)?.closed).sort((a, b) => a.localeCompare(b))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inUse, accountDetails, kinds]
  )
  useEffect(() => {
    if (editing || !cardEmi || !card?.statementDay) return
    const billed = nextStatementDate(card.statementDay, todayISO())
    setForm((f) => (f.nextDate === billed ? f : { ...f, nextDate: billed }))
  }, [editing, cardEmi, card?.statementDay])


  const handleSubmit = async () => {
    errors.clear()
    const amountNum = Number(form.amount)
    if (!form.name.trim()) return errors.fail(`Enter a ${kind === 'subscription' ? 'service' : 'payment'} name.`, 'name')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return errors.fail('Enter the amount.', 'amount')
    if (!form.nextDate) return errors.fail('Choose the next date.', 'nextDate')
    // Required so "Mark as paid" always has somewhere to log the actual
    // expense transaction against -- see useRecurring.ts's markPaid.
    if (!form.account) return errors.fail('Choose an account.', 'account')
    let loan: RecurringLoanInput | null = null
    if (form.isLoan) {
      const loanAmount = Number(form.loanAmount)
      const tenure = Number(form.loanTenure)
      if (!supportsLoanDetails(form.cadence)) return errors.fail('Loan details need a monthly (or longer) cadence.', 'cadence')
      if (!Number.isFinite(loanAmount) || loanAmount <= 0) return errors.fail('Enter the loan amount.', 'loanAmount')
      if (!Number.isInteger(tenure) || tenure < 1 || tenure > 600) return errors.fail('Enter the tenure in months (1 to 600).', 'loanTenure')
      if (!MONTH_KEY.test(form.loanStart)) return errors.fail('Choose the month of the first EMI.', 'loanStart')
      const rate = form.loanRate.trim() === '' ? null : Number(form.loanRate)
      if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
        return errors.fail('Enter the interest rate as a yearly % between 0 and 100, or leave it empty.', 'loanRate')
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
          goal_id: goalId || null,
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
          goalId: goalId || null,
        })
      }
      // The card's "paid from" account and a new EMI's processing fee: the item
      // is saved either way; a failure here is said once in a toast.
      if (cardEmi && payFrom !== (card?.payFrom ?? '')) {
        await setCardPayFrom.mutateAsync({ account: form.account, from: payFrom || null }).catch(() => show('Saved, but the card’s “paid from” account didn’t change.', { tone: 'error' }))
      }
      const fee = Number(processingFee)
      if (!editing && cardEmi && fee > 0) {
        await addTransaction
          .mutateAsync({
            type: 'expense',
            amount: Math.round(fee * 1.18 * 100) / 100,
            merchant: `${form.name.trim()} EMI processing fee`,
            date: todayISO(),
            category: allExpenseCategories.includes('Fees & charges') ? 'Fees & charges' : 'Needs review',
            account: form.account,
            remarks: 'Includes 18% GST',
            tags: ['emi'],
            receipt: false,
            allowDuplicate: true,
          })
          .catch(() => show('Saved, but the processing fee wasn’t logged.', { tone: 'error' }))
      }
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const saving = addManual.isPending || update.isPending || setCardPayFrom.isPending || addTransaction.isPending
  // Card EMIs: the bank adds 18% GST on each month's interest. With a rate, the
  // interest over the whole loan is EMIs minus the amount borrowed.
  const gst = (() => {
    const n = Number(form.loanTenure)
    const principal = Number(form.loanAmount)
    const rate = Number(form.loanRate)
    if (!form.isLoan || !(n > 0) || !(principal > 0) || !(rate > 0)) return null
    const emi = emiFor(principal, rate, n)
    const total = Math.round(Math.max(0, emi * n - principal) * 0.18 * 100) / 100
    return { total, monthly: Math.round((total / n) * 100) / 100, emi }
  })()
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
        <FormError message={errors.general} />
        <TextField
          label={kind === 'subscription' ? 'Service name' : 'Name'}
          error={errors.on('name')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label="Amount"
            error={errors.on('amount')}
            value={form.amount}
            onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Cadence</label>
            <Dropdown
              options={CADENCES}
              error={errors.on('cadence')}
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
          {/* A card EMI's date comes from the card: it's billed on the statement date. */}
          {cardEmi && card?.statementDay ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-helper font-medium text-slate-600">Next EMI</span>
              <span className="flex min-h-[44px] items-center rounded-lg border border-app-border bg-slate-50 px-3 text-sm text-slate-700">
                {formatShortDate(form.nextDate)}
              </span>
            </div>
          ) : (
            <TextField
              label="Next date"
              type="date"
              error={errors.on('nextDate')}
              value={form.nextDate}
              onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
            />
          )}
        </div>
        {/* Full width: inside the half-width Category column the add box spilled over. */}
        <div className="-mt-2">
          <QuickAddCategory variant="link" kind="expense" onAdded={(category) => setForm((f) => ({ ...f, category }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">
            {form.isLoan ? (paidBy === 'card' ? 'Credit card' : 'Bank account') : 'Account'}
          </label>
          <Dropdown
            options={accountOptions}
            error={errors.on('account')}
            value={form.account}
            onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
          />
          <p className="text-helper text-slate-500">
            {form.isLoan && paidBy === 'card'
              ? accountOptions.length === 0
                ? 'Add your credit card in Settings, Accounts & cards first.'
                : 'Mark paid adds that month’s EMI to this card’s bill.'
              : isCard(form.account)
                ? 'Marking this paid adds it to this card’s bill. You pay it when you pay the card.'
                : 'Marking this paid logs an expense against this account.'}
          </p>
        </div>
        {/* A SIP (or an RD, a savings transfer) can feed a goal: each Mark paid adds to it. */}
        {goals.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-helper font-medium text-slate-600">Add each payment to a goal</label>
            <Dropdown
              options={['', ...goals.map((g) => g.name)]}
              value={goals.find((g) => g.id === goalId)?.name ?? ''}
              aria-label="Goal this payment adds to"
              onChange={(e) => setGoalId(goals.find((g) => g.name === e.target.value)?.id ?? '')}
            />
            <p className="text-helper text-slate-500">
              {goalId
                ? 'Each time you tap Paid, this amount is added to the goal, and Goals shows when you’ll reach it.'
                : 'Saving for something with a SIP or RD? Pick the goal, and each payment adds to it.'}
            </p>
          </div>
        )}
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
                <div className="flex flex-col gap-1.5">
                  <span className="text-helper font-medium text-slate-600">How is the EMI paid?</span>
                  <div role="radiogroup" aria-label="How is the EMI paid" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {(
                      [
                        ['card', 'On my credit card bill'],
                        ['bank', 'From my bank account'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={paidBy === value}
                        onClick={() => choosePaidBy(value)}
                        className={clsx(
                          'min-h-[44px] rounded-lg px-2 text-helper font-semibold leading-tight transition-colors',
                          paidBy === value ? 'bg-app-card text-slate-900 shadow-card' : 'text-slate-500'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-helper text-slate-500">
                    {paidBy === 'card'
                      ? 'Bought on the card and turned into EMIs: each month’s EMI goes on the card bill, which you pay from your bank as usual. The loan still to repay is held from the card’s limit until it’s paid off. Don’t also log the full purchase.'
                      : 'Each EMI is taken straight from your bank account (home, car or personal loans).'}
                  </p>
                </div>
                {cardEmi && (
                  <>
                    <p className="text-helper text-slate-500">
                      {card?.statementDay
                        ? `The EMI date comes from the card: it's billed on the statement date, the ${card.statementDay}${ordinal(card.statementDay)} of each month.`
                        : 'Add this card’s statement day in Settings, Accounts & cards, and the EMI date will follow it.'}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-helper font-medium text-slate-600">Card bill paid from</label>
                      <Dropdown
                        options={payFromOptions.includes(payFrom) ? payFromOptions : [...payFromOptions, payFrom]}
                        value={payFrom}
                        aria-label="Account the card bill is paid from"
                        onChange={(e) => setPayFrom(e.target.value)}
                      />
                      <p className="text-helper text-slate-500">Used when you tap Pay on this card’s bill.</p>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <MoneyField
                    label="Loan amount"
                    error={errors.on('loanAmount')}
                    value={form.loanAmount}
                    onChange={(v) => setForm((f) => ({ ...f, loanAmount: v }))}
                  />
                  <TextField
                    label="Tenure (months)"
                    type="number"
                    step="1"
                    min="1"
                    max="600"
                    error={errors.on('loanTenure')}
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
                    error={errors.on('loanRate')}
                    value={form.loanRate}
                    onChange={(e) => setForm((f) => ({ ...f, loanRate: e.target.value }))}
                  />
                  <MonthField
                    id="recurring-loan-start"
                    label="First EMI (month)"
                    error={errors.on('loanStart')}
                    value={form.loanStart}
                    onChange={(loanStart) => setForm((f) => ({ ...f, loanStart }))}
                  />
                </div>
                {cardEmi && (
                  <p className="text-helper text-slate-500">
                    {gst
                      ? <>
                          The bank also adds 18% GST on the interest: about {format(gst.monthly)} a month ({format(gst.total)} in all), a bit more at the start.{' '}
                          {Math.abs(Number(form.amount) - gst.emi) < 1 && (
                            <button
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, amount: (gst.emi + gst.monthly).toFixed(2) }))}
                              className="font-medium text-accent-dark hover:underline"
                            >
                              Add it to the EMI
                            </button>
                          )}
                        </>
                      : 'No-cost EMI? The bank still adds 18% GST on the interest it books, so use the EMI amount from your statement.'}
                  </p>
                )}
                {cardEmi && !editing && (
                  <div className="flex flex-col gap-1">
                    <MoneyField label="Processing fee (optional)" value={processingFee} onChange={setProcessingFee} />
                    <p className="text-helper text-slate-500">Charged once on the first bill. Logged on the card with 18% GST added.</p>
                  </div>
                )}
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
      </div>
    </Modal>
  )
}
