import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { loanDetailsOf, loanMonthLabel, loanProgress } from '@/lib/loans'

interface ConfirmedItemRowProps {
  item: RecurringItem
  /** The item's account balance (derived from logged transactions), or null
   *  when it has no account yet -- used only to flag a payment the account
   *  can't currently cover, never to block anything. */
  accountBalance: number | null
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onMarkPaid: () => void
  markPaidPending: boolean
}

export function ConfirmedItemRow({
  item,
  accountBalance,
  onEdit,
  onDelete,
  onToggleActive,
  onMarkPaid,
  markPaidPending,
}: ConfirmedItemRowProps) {
  const { format, formatCompact } = useFormatCurrency()
  // Nothing ever advances next_date automatically (no cron, no matching a
  // logged transaction back to this item) -- once today passes it, it just
  // sits there looking like it's still "coming up" unless flagged here.
  const isOverdue = item.active && item.next_date < todayISO()
  // Nothing here actually pauses anything (there's no automated charge to
  // pause -- every payment is a manual "mark as paid") -- this just warns
  // that the account behind it can't currently cover the amount, same
  // heads-up AddEntryModal already gives for an overdrawing transfer.
  const insufficientBalance = item.active && accountBalance !== null && accountBalance < item.amount
  // Loan / EMI: how many installments are paid (everything due before
  // next_date -- see src/lib/loans.ts), what's left and when it ends.
  const loan = loanDetailsOf(item)
  const progress = loan ? loanProgress(loan, item.amount, item.cadence, item.next_date) : null

  // Two rows, so nothing is squeezed at phone width: name + amount on top,
  // details + actions underneath, then any warning across the full width.
  // (One row used to leave the name "HDFC Defen..." and wrap the warning a
  // word per line in a thin column.)
  return (
    <li
      className={clsx(
        'flex flex-col gap-1.5 rounded-xl px-3 py-3',
        insufficientBalance
          ? 'bg-danger-light'
          : isOverdue
          ? 'bg-caution-light'
          : 'border-b border-app-border last:border-b-0'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 min-w-0 text-sm font-semibold text-slate-800" title={item.name}>
          {item.name}
        </p>
        <span className="shrink-0 font-serif text-base font-semibold tabular-nums text-slate-900">{format(item.amount)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-helper text-slate-500">
          {item.category} · {item.cadence}
          {item.account ? ` · ${item.account}` : ''} ·{' '}
          {isOverdue ? (
            <span className="inline-flex items-center rounded-full bg-app-card px-2 py-0.5 text-xs font-semibold text-caution">
              Overdue since {formatShortDate(item.next_date)}
            </span>
          ) : (
            <>next {formatShortDate(item.next_date)}</>
          )}
        </p>
        <div className="-mr-1.5 ml-auto flex shrink-0 items-center gap-1">
          <label className="mr-1 flex min-h-[32px] items-center gap-1.5 text-helper text-slate-600">
            <input type="checkbox" checked={item.active} onChange={onToggleActive} className="h-4 w-4" />
            Active
          </label>
          {isOverdue && (
            // Pre-existing items created before an account was required can
            // still be missing one -- mark-as-paid needs somewhere to log the
            // expense transaction against, so route to Edit instead until then.
            <button
              aria-label={item.account ? `Mark ${item.name} as paid` : `Add an account to ${item.name} before marking it paid`}
              title={item.account ? 'Mark as paid -- logs the expense and moves the next due date forward' : 'Add an account first (Edit) to mark this paid'}
              onClick={item.account ? onMarkPaid : onEdit}
              disabled={markPaidPending}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-positive-light hover:text-positive disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
            </button>
          )}
          <button
            aria-label="Edit"
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={15} />
          </button>
          <button
            aria-label="Delete"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-danger-light hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {loan && progress && (
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-app-card/70 p-2.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-800">
              {progress.done ? `All ${progress.total} EMIs paid` : `${progress.paid} of ${progress.total} EMIs paid`}
              {loan.interestRate != null && <span className="font-normal text-slate-500"> · {loan.interestRate}% a year</span>}
            </span>
            <span className="shrink-0 text-helper text-slate-500">
              {progress.done ? 'Loan closed' : `${progress.remaining} left · ends ${loanMonthLabel(progress.endMonth)}`}
            </span>
          </div>
          <ProgressBar percent={(progress.paid / progress.total) * 100} tone={progress.done ? 'positive' : 'accent'} />
          <p className="text-helper text-slate-500">
            {formatCompact(progress.paidAmount)} repaid of {formatCompact(progress.totalPayable)} · loan {formatCompact(loan.amount)}
            {progress.interest > 0 ? ` · ${formatCompact(progress.interest)} interest` : ''}
          </p>
        </div>
      )}
      {insufficientBalance && (
        <p className="flex items-start gap-1.5 text-helper font-medium text-danger">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Low balance: {item.account} doesn't have enough to cover this yet.</span>
        </p>
      )}
    </li>
  )
}
