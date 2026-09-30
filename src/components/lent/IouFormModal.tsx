import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { MoneyField } from '@/components/ui/MoneyField'
import { DateField } from '@/components/ui/DateField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useIous, type Iou } from '@/hooks/useIous'
import { todayISO } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { LogEntryToggle, PICK_ACCOUNT, useLogIouEntry } from './LogEntryToggle'
import type { IouDirection } from '@/types/database.types'

interface IouFormModalProps {
  open: boolean
  onClose: () => void
  editing?: Iou | null
  /** New records start on this side ("I lent" / "I borrowed"). */
  initialDirection?: IouDirection
  /** Names already used, offered as suggestions. */
  people: string[]
  onDelete?: () => void
}

export function IouFormModal({ open, onClose, editing, initialDirection = 'lent', people, onDelete }: IouFormModalProps) {
  const { create, update } = useIous()
  const [direction, setDirection] = useState<IouDirection>(initialDirection)
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const errors = useFieldErrors<'person' | 'amount' | 'dueDate' | 'logAccount'>()
  const logEntry = useLogIouEntry()
  const { show } = useToast()
  // "Also add to my entries" (new records only): logs the money moving in or out.
  const [logIt, setLogIt] = useState(false)
  const [logAccount, setLogAccount] = useState(PICK_ACCOUNT)
  const clearErrors = errors.clear

  // Stays mounted between opens, so reset from `editing` each time it opens.
  useEffect(() => {
    if (!open) return
    setDirection(editing?.direction ?? initialDirection)
    setPerson(editing?.person ?? '')
    setAmount(editing ? String(editing.amount) : '')
    setDate(editing?.date ?? todayISO())
    setDueDate(editing?.due_date ?? '')
    setNote(editing?.note ?? '')
    setLogIt(false)
    setLogAccount(PICK_ACCOUNT)
    clearErrors()
  }, [open, editing, initialDirection, clearErrors])

  const save = async () => {
    errors.clear()
    const amountNum = Number(amount)
    if (!person.trim()) return errors.fail('Who is it? Type their name.', 'person')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return errors.fail('Enter the amount.', 'amount')
    if (dueDate && dueDate < date) return errors.fail('The pay-back date can’t be before the date.', 'dueDate')
    const logging = !editing && logIt
    if (logging && logAccount === PICK_ACCOUNT) return errors.fail('Choose the account.', 'logAccount')
    const input = { person, direction, amount: amountNum, date, dueDate: dueDate || null, note: note.trim() || null }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...input })
      else await create.mutateAsync(input)
      if (logging) {
        // The record is saved either way; a failed entry is said once, not retried.
        try {
          await logEntry.log(direction === 'lent' ? 'lent' : 'borrowed', person, amountNum, date, logAccount)
          show(direction === 'lent' ? 'Saved, and logged as money out' : 'Saved, and logged as money in')
        } catch (e) {
          show(`Saved, but the entry wasn't added: ${e instanceof Error ? e.message : 'try again'}`, { tone: 'error' })
        }
      }
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Couldn’t save this. Try again.')
    }
  }

  const listId = 'iou-people'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit' : direction === 'lent' ? 'I lent money' : 'I borrowed money'}
      headerActions={
        <>
          {editing && onDelete && <SheetDeleteButton onClick={onDelete} />}
          <SheetSaveButton onClick={save} busy={create.isPending || update.isPending || logEntry.isPending} label="Save" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <div role="radiogroup" aria-label="Lent or borrowed" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ['lent', 'I lent'],
              ['borrowed', 'I borrowed'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={direction === value}
              onClick={() => setDirection(value)}
              className={clsx(
                'min-h-[44px] rounded-lg text-sm font-semibold transition-colors',
                direction === value
                  ? value === 'lent'
                    ? 'bg-app-card text-positive shadow-card'
                    : 'bg-app-card text-danger shadow-card'
                  : 'text-slate-500'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <TextField
          label={direction === 'lent' ? 'Lent to' : 'Borrowed from'}
          placeholder="Their name"
          list={listId}
          autoComplete="off"
          maxLength={80}
          error={errors.on('person')} value={person}
          onChange={(e) => setPerson(e.target.value)}
        />
        <datalist id={listId}>
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <MoneyField
          label="Amount"
          error={errors.on('amount')} value={amount}
          onChange={setAmount}
        />
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <DateField
            label="Pay back by (optional)"
            placeholder="No date"
            error={errors.on('dueDate')} value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <TextField label="Note (optional)" maxLength={200} placeholder="e.g. for the trip" value={note} onChange={(e) => setNote(e.target.value)} />
        {!editing && (
          <LogEntryToggle
            checked={logIt}
            onCheckedChange={setLogIt}
            account={logAccount}
            onAccountChange={setLogAccount}
            moneyIn={direction === 'borrowed'}
            error={errors.on('logAccount')}
          />
        )}
        {!logIt && (
          <p className="text-helper text-slate-500">
            This keeps track of who owes what. It doesn’t change your account balances unless you tick “Also add to my entries”.
          </p>
        )}
      </div>
    </Modal>
  )
}
