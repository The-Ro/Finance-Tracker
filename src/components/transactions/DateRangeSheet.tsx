import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { DateField } from '@/components/ui/DateField'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { addDaysISO } from '@/lib/billCalendar'
import { todayISO } from '@/lib/format'
import type { DateRange } from '@/lib/period'

/**
 * Activity's "Pick dates": one day, or from one date to another. Leaving "To"
 * empty means just that day. Quick chips for Today and Yesterday.
 */
export function DateRangeSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean
  initial: DateRange | null
  onClose: () => void
  onApply: (range: DateRange) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const errors = useFieldErrors<'from' | 'to'>()
  const clearErrors = errors.clear
  const today = todayISO()

  useEffect(() => {
    if (!open) return
    setFrom(initial?.start ?? today)
    setTo(initial && initial.start !== initial.end ? initial.end : '')
    clearErrors()
  }, [open, initial, today, clearErrors])

  const apply = (start: string, end: string) => {
    onApply({ start, end })
    onClose()
  }
  const save = () => {
    errors.clear()
    if (!from) return errors.fail('Pick a day.', 'from')
    if (to && to < from) return errors.fail('“To” can’t be before “From”.', 'to')
    apply(from, to || from)
  }

  const quick: [string, string][] = [
    ['Today', today],
    ['Yesterday', addDaysISO(today, -1)],
  ]

  return (
    <Modal open={open} onClose={onClose} title="Pick dates" headerActions={<SheetSaveButton onClick={save} label="Show" />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {quick.map(([label, day]) => (
            <button
              key={label}
              type="button"
              onClick={() => apply(day, day)}
              className={clsx(
                'press min-h-[40px] rounded-full border px-3 text-helper font-semibold',
                initial?.start === day && initial.end === day
                  ? 'border-accent bg-accent-light text-accent-on-light'
                  : 'border-app-border text-slate-600 hover:border-accent'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateField label="From" value={from} error={errors.on('from')} onChange={(e) => setFrom(e.target.value)} />
          <DateField label="To (optional)" value={to} error={errors.on('to')} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="text-helper text-slate-500">Leave “To” empty to see just one day.</p>
      </div>
    </Modal>
  )
}
