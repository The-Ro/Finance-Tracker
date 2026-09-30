import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { MoneyField } from '@/components/ui/MoneyField'
import { DateField } from '@/components/ui/DateField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useIous, type IouPaymentRow } from '@/hooks/useIous'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import type { IouLine } from '@/lib/ious'
import { useToast } from '@/context/ToastContext'
import { LogEntryToggle, PICK_ACCOUNT, useLogIouEntry } from './LogEntryToggle'

/** "Got paid back" (money you lent) / "Paid back" (money you borrowed): all or part of what's left. */
export function RepayModal({
  line,
  payments,
  onClose,
}: {
  line: IouLine | null
  payments: IouPaymentRow[]
  onClose: () => void
}) {
  const { addPayment, removePayment } = useIous()
  const { format } = useFormatCurrency()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const errors = useFieldErrors<'amount' | 'logAccount'>()
  const logEntry = useLogIouEntry()
  const { show } = useToast()
  const [logIt, setLogIt] = useState(false)
  const [logAccount, setLogAccount] = useState(PICK_ACCOUNT)
  const clearErrors = errors.clear

  useEffect(() => {
    if (!line) return
    setAmount(String(line.left))
    setDate(todayISO())
    setLogIt(false)
    setLogAccount(PICK_ACCOUNT)
    clearErrors()
  }, [line, clearErrors])

  if (!line) return null
  const lent = line.direction === 'lent'
  const history = payments.filter((p) => p.iou_id === line.id)

  const save = async () => {
    errors.clear()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return errors.fail('Enter the amount.', 'amount')
    if (n > line.left + 0.001) return errors.fail(`Only ${format(line.left)} is left.`, 'amount')
    if (logIt && logAccount === PICK_ACCOUNT) return errors.fail('Choose the account.', 'logAccount')
    try {
      await addPayment.mutateAsync({ iouId: line.id, amount: n, date })
      if (logIt) {
        try {
          await logEntry.log(lent ? 'got-back' : 'paid-back', line.person, n, date, logAccount)
          show(lent ? 'Saved, and logged as money in' : 'Saved, and logged as money out')
        } catch (e) {
          show(`Saved, but the entry wasn't added: ${e instanceof Error ? e.message : 'try again'}`, { tone: 'error' })
        }
      }
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Couldn’t save this. Try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={lent ? `${line.person} paid you back` : `You paid ${line.person} back`}
      headerActions={<SheetSaveButton onClick={save} busy={addPayment.isPending || logEntry.isPending} label="Save" />}
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <p className="text-sm text-slate-600">
          {format(line.left)} left of {format(line.amount)} {lent ? 'you lent' : 'you borrowed'} on {formatShortDate(line.date)}.
        </p>
        <div className="flex gap-2">
          {[
            ['All of it', line.left],
            ['Half', Math.round((line.left / 2) * 100) / 100],
          ].map(([label, value]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => setAmount(String(value))}
              className="press min-h-[36px] rounded-full border border-app-border px-3 text-helper font-medium text-slate-700 hover:border-accent"
            >
              {label} · {format(value as number)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Amount" error={errors.on('amount')} value={amount} onChange={setAmount} />
          <DateField label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <LogEntryToggle
          checked={logIt}
          onCheckedChange={setLogIt}
          account={logAccount}
          onAccountChange={setLogAccount}
          moneyIn={lent}
          error={errors.on('logAccount')}
        />
        {history.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-app-border pt-3">
            <p className="text-helper font-semibold text-slate-600">Paid back so far</p>
            <ul className="flex flex-col divide-y divide-app-border">
              {history.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-600">{formatShortDate(p.date)}</span>
                  <span className="ml-auto font-semibold tabular-nums text-slate-900">{format(p.amount)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${format(p.amount)} from ${formatShortDate(p.date)}`}
                    onClick={() => removePayment.mutate(p.id)}
                    disabled={removePayment.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-danger-light hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
