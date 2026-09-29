import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { DateField } from '@/components/ui/DateField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useIous, type IouPaymentRow } from '@/hooks/useIous'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import type { IouLine } from '@/lib/ious'

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!line) return
    setAmount(String(line.left))
    setDate(todayISO())
    setError(null)
  }, [line])

  if (!line) return null
  const lent = line.direction === 'lent'
  const history = payments.filter((p) => p.iou_id === line.id)

  const save = async () => {
    setError(null)
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return setError('Enter the amount.')
    if (n > line.left + 0.001) return setError(`Only ${format(line.left)} is left.`)
    try {
      await addPayment.mutateAsync({ iouId: line.id, amount: n, date })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save this. Try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={lent ? `${line.person} paid you back` : `You paid ${line.person} back`}
      headerActions={<SheetSaveButton onClick={save} busy={addPayment.isPending} label="Save" />}
    >
      <div className="flex flex-col gap-4">
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
          <TextField label="Amount" type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <DateField label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
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
