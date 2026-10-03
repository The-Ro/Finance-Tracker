import { useEffect, useState } from 'react'
import { BellPlus, Check, Send } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MoneyField } from '@/components/ui/MoneyField'
import { DateField } from '@/components/ui/DateField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useMoneyReminders, type MoneyReminder } from '@/hooks/useMoneyReminders'
import { useMarkReminderSent } from '@/hooks/useMarkReminderSent'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { Dropdown } from '@/components/ui/Dropdown'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useClosedAccounts } from '@/hooks/useCards'
import { useCategories } from '@/hooks/useLookupLists'
import { PAYMENT_METHODS } from '@/lib/cardNetworks'
import { addDaysISO } from '@/lib/billCalendar'
import { formatShortDate, todayISO } from '@/lib/format'

/**
 * "Money to send" on Bills: a small icon in the calendar's header (a badge
 * counts what's open; red when something is due today or late) that opens
 * the list of one-off reminders to send money to someone or for something
 * ("₹500 to Mom on the 5th"). The bell (and the phone, with reminders on)
 * gets a note on the day. "Sent" ticks it off and offers to log it as an
 * entry; nothing moves money on its own.
 */
export function MoneyRemindersButton() {
  const { data = [] } = useMoneyReminders()
  const { format } = useFormatCurrency()
  const [listOpen, setListOpen] = useState(false)
  const [editing, setEditing] = useState<MoneyReminder | 'new' | null>(null)
  const today = todayISO()
  const open = data.filter((r) => !r.done_at)
  const urgent = open.some((r) => r.due_date <= today)

  // Same step as the bell's quick tick (useMarkReminderSent).
  const { markSent, busy: sending } = useMarkReminderSent()

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        aria-label={`Money to send${open.length ? ` (${open.length})` : ''}`}
        title="Money to send"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
      >
        <Send size={17} aria-hidden="true" />
        {open.length > 0 && (
          <span
            className={clsx(
              'animate-pop-in absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white',
              urgent ? 'bg-danger' : 'bg-brass'
            )}
          >
            {open.length}
          </span>
        )}
      </button>

      {/* The list; it steps aside while a reminder is being added or edited. */}
      <Modal open={listOpen && !editing} onClose={() => setListOpen(false)} title="Money to send">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-helper text-slate-500">We remind you on the day.</p>
            <Button variant="secondary" className="shrink-0" onClick={() => setEditing('new')}>
              <BellPlus size={15} aria-hidden="true" /> Remind me
            </Button>
          </div>
          {open.length === 0 ? (
            <p className="text-helper text-slate-500">Nothing to send. Add a reminder, like pocket money or a fee.</p>
          ) : (
            <ul className="stagger-rows flex flex-col divide-y divide-app-border">
              {open.map((r) => {
                const overdue = r.due_date < today
                const when =
                  r.due_date === today ? 'Today' : r.due_date === addDaysISO(today, 1) ? 'Tomorrow' : formatShortDate(r.due_date)
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass-light text-brass">
                        <Send size={17} aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-slate-900">{r.title}</span>
                        <span className={clsx('text-helper', overdue ? 'font-medium text-danger' : 'text-slate-500')}>
                          {r.amount != null && `${format(r.amount)} · `}
                          {overdue ? `Was due ${when}` : when}
                          {r.note && ` · ${r.note}`}
                          {r.log_entry && r.account && ` · logs from ${r.account}`}
                        </span>
                      </span>
                    </button>
                    <Button variant="secondary" className="shrink-0" onClick={() => void markSent(r)} disabled={sending}>
                      <Check size={15} aria-hidden="true" /> Sent
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>
      <MoneyReminderForm editing={editing} onClose={() => setEditing(null)} />
    </>
  )
}

const PICK = 'Choose an account'

function MoneyReminderForm({ editing, onClose }: { editing: MoneyReminder | 'new' | null; onClose: () => void }) {
  const { create, update, remove } = useMoneyReminders()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [logEntry, setLogEntry] = useState(false)
  const [account, setAccount] = useState(PICK)
  const [mode, setMode] = useState('')
  const [category, setCategory] = useState('')
  const { inUse } = useAccountsInUse()
  const closed = useClosedAccounts()
  const { expense: expenseCategories } = useCategories()
  const accountOptions = [...inUse].filter((a) => !closed.has(a)).sort((a, b) => a.localeCompare(b))
  const errors = useFieldErrors<'title' | 'amount' | 'dueDate' | 'account'>()
  const clearErrors = errors.clear
  const existing = editing && editing !== 'new' ? editing : null

  useEffect(() => {
    if (!editing) return
    setTitle(existing?.title ?? '')
    setAmount(existing?.amount != null ? String(existing.amount) : '')
    setDueDate(existing?.due_date ?? addDaysISO(todayISO(), 1))
    setNote(existing?.note ?? '')
    setLogEntry(existing?.log_entry ?? false)
    setAccount(existing?.account ?? PICK)
    setMode(existing?.payment_method ?? '')
    setCategory(existing?.category ?? '')
    clearErrors()
  }, [editing, existing, clearErrors])

  const save = async () => {
    errors.clear()
    const n = amount ? Number(amount) : null
    if (!title.trim()) return errors.fail('Who or what is it for?', 'title')
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return errors.fail('Enter an amount above zero, or leave it empty.', 'amount')
    if (!dueDate) return errors.fail('Choose the day.', 'dueDate')
    if (logEntry && n === null) return errors.fail('Enter the amount to log it.', 'amount')
    if (logEntry && account === PICK) return errors.fail('Choose the account it goes from.', 'account')
    const input = {
      title,
      amount: n,
      dueDate,
      note,
      logEntry,
      account: logEntry ? account : null,
      paymentMethod: mode || null,
      category: category || null,
    }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...input })
      else await create.mutateAsync(input)
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Couldn’t save this. Try again.')
    }
  }

  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={existing ? 'Edit reminder' : 'Remind me to send money'}
      headerActions={
        <>
          {existing && (
            <SheetDeleteButton
              onClick={() => {
                remove.mutate(existing.id)
                onClose()
              }}
            />
          )}
          <SheetSaveButton onClick={save} busy={create.isPending || update.isPending} label="Save" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <TextField
          label="To whom, or for what"
          placeholder="e.g. Mom, school fees"
          maxLength={80}
          error={errors.on('title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Amount (optional)" error={errors.on('amount')} value={amount} onChange={setAmount} />
          <DateField label="On" error={errors.on('dueDate')} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <TextField label="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        {/* Log it when Sent is tapped: account, mode and category for the entry. */}
        <div className={clsx('flex flex-col gap-3 rounded-xl border p-3', logEntry ? 'border-accent' : 'border-app-border')}>
          <label className="flex min-h-[40px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={logEntry}
              onChange={(e) => setLogEntry(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-slate-800">Log it when I tap Sent</span>
              <span className="text-helper text-slate-500">Adds it to your entries as money out, from this account.</span>
            </span>
          </label>
          {logEntry && (
            <div className="animate-fade-in-up flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-helper font-medium text-slate-600">From</span>
                <Dropdown
                  options={account === PICK ? [PICK, ...accountOptions] : accountOptions}
                  value={account}
                  aria-label="Account it goes from"
                  error={errors.on('account')}
                  onChange={(e) => setAccount(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-helper font-medium text-slate-600">Mode</span>
                  <Dropdown options={['', ...PAYMENT_METHODS]} value={mode} aria-label="Mode" onChange={(e) => setMode(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-helper font-medium text-slate-600">Category</span>
                  <Dropdown options={['', ...expenseCategories]} value={category} aria-label="Category" onChange={(e) => setCategory(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-helper text-slate-500">
          You’ll get a note in the bell at 9 AM that day (and on your phone if reminders are on). Tap Sent when it’s done.
        </p>
      </div>
    </Modal>
  )
}
