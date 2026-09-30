import { useEffect, useState } from 'react'
import { BellPlus, Check, Send } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MoneyField } from '@/components/ui/MoneyField'
import { DateField } from '@/components/ui/DateField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useMoneyReminders, type MoneyReminder } from '@/hooks/useMoneyReminders'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useToast } from '@/context/ToastContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { addDaysISO } from '@/lib/billCalendar'
import { formatShortDate, todayISO } from '@/lib/format'

/**
 * "Money to send" on Bills: one-off reminders to send money to someone or
 * for something ("₹500 to Mom on the 5th"). The bell (and the phone, with
 * reminders on) gets a note on the day. "Sent" ticks it off and offers to
 * log it as an entry; nothing moves money on its own.
 */
export function MoneyReminders() {
  const { data = [], setDone } = useMoneyReminders()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const { openAddEntry } = useGlobalModals()
  const [editing, setEditing] = useState<MoneyReminder | 'new' | null>(null)
  const today = todayISO()
  const open = data.filter((r) => !r.done_at)

  const markSent = (r: MoneyReminder) =>
    setDone.mutate(
      { id: r.id, done: true },
      {
        onSuccess: () =>
          show('Marked as sent', {
            action: { label: 'Log it', onClick: () => openAddEntry('expense', { merchant: r.title, amount: r.amount ?? undefined }) },
          }),
      }
    )

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-slate-900">Money to send</h2>
          <p className="text-helper text-slate-500">We remind you on the day.</p>
        </div>
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
                    </span>
                  </span>
                </button>
                <Button variant="secondary" className="shrink-0" onClick={() => markSent(r)} disabled={setDone.isPending}>
                  <Check size={15} aria-hidden="true" /> Sent
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <MoneyReminderForm editing={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function MoneyReminderForm({ editing, onClose }: { editing: MoneyReminder | 'new' | null; onClose: () => void }) {
  const { create, update, remove } = useMoneyReminders()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const errors = useFieldErrors<'title' | 'amount' | 'dueDate'>()
  const clearErrors = errors.clear
  const existing = editing && editing !== 'new' ? editing : null

  useEffect(() => {
    if (!editing) return
    setTitle(existing?.title ?? '')
    setAmount(existing?.amount != null ? String(existing.amount) : '')
    setDueDate(existing?.due_date ?? addDaysISO(todayISO(), 1))
    setNote(existing?.note ?? '')
    clearErrors()
  }, [editing, existing, clearErrors])

  const save = async () => {
    errors.clear()
    const n = amount ? Number(amount) : null
    if (!title.trim()) return errors.fail('Who or what is it for?', 'title')
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return errors.fail('Enter an amount above zero, or leave it empty.', 'amount')
    if (!dueDate) return errors.fail('Choose the day.', 'dueDate')
    const input = { title, amount: n, dueDate, note }
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
        <p className="text-helper text-slate-500">
          You’ll get a note in the bell at 9 AM that day (and on your phone if reminders are on). Tap Sent when it’s done.
        </p>
      </div>
    </Modal>
  )
}
