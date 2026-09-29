import clsx from 'clsx'
import { AlertTriangle, Check } from 'lucide-react'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { loanDetailsOf, loanMonthLabel, loanProgress } from '@/lib/loans'

interface ConfirmedItemRowProps {
  item: RecurringItem
  /** The category's chosen icon, if any. */
  iconKey?: string | null
  /** Its account can't cover the payments due from it (see
   *  accountShortfalls) -- a heads-up only, never blocks anything. The page
   *  explains it once per account; the row just marks the account. */
  lowBalance: boolean
  onEdit: () => void
  onToggleActive: () => void
  onMarkPaid: () => void
  markPaidPending: boolean
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Every 6 months',
  annual: 'Yearly',
}

/**
 * One confirmed item as a plain list row: icon, name and amount, details
 * underneath. Tapping it opens the edit sheet (which also deletes); the switch
 * pauses it. It used to be a tinted card with its own edit/delete buttons and
 * a full-width "Low balance" sentence -- three bills on one account read as a
 * wall of red.
 */
export function ConfirmedItemRow({
  item,
  iconKey,
  lowBalance,
  onEdit,
  onToggleActive,
  onMarkPaid,
  markPaidPending,
}: ConfirmedItemRowProps) {
  const { format, formatCompact } = useFormatCurrency()
  // Nothing ever advances next_date automatically (no cron) -- once today
  // passes it, it's overdue until someone marks it paid.
  const isOverdue = item.active && item.next_date < todayISO()
  const loan = loanDetailsOf(item)
  const progress = loan ? loanProgress(loan, item.amount, item.cadence, item.next_date) : null

  return (
    <li className={clsx('flex items-start gap-3 py-3', !item.active && 'opacity-60')}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${item.name}`}
        className="press flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light"
        >
          <CategoryIcon category={item.category} type="expense" iconKey={iconKey} size={19} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
            <span className="shrink-0 font-serif text-base font-semibold tabular-nums text-slate-900">
              {format(item.amount)}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-helper text-slate-500">
            <span className="shrink-0">
              {CADENCE_LABELS[item.cadence] ?? item.cadence}
              {item.account ? ' · ' : ''}
            </span>
            {item.account && (
              <span className={clsx('flex min-w-0 items-center gap-1', lowBalance && 'font-medium text-caution')}>
                {lowBalance && <AlertTriangle size={12} className="shrink-0" aria-label="Not enough money" />}
                <span className="truncate">{item.account}</span>
              </span>
            )}
          </span>
          <span className="text-helper">
            {!item.active ? (
              <span className="text-slate-500">Paused</span>
            ) : isOverdue ? (
              <span className="font-semibold text-caution">Overdue since {formatShortDate(item.next_date)}</span>
            ) : (
              <span className="text-slate-500">Next {formatShortDate(item.next_date)}</span>
            )}
          </span>
          {loan && progress && (
            <span className="mt-1.5 flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-3 text-helper">
                <span className="font-medium text-slate-700">
                  {progress.done ? `All ${progress.total} EMIs paid` : `${progress.paid} of ${progress.total} EMIs paid`}
                </span>
                <span className="shrink-0 text-slate-500">
                  {progress.done ? 'Loan closed' : `${progress.remaining} left · ${loanMonthLabel(progress.endMonth)}`}
                </span>
              </span>
              <ProgressBar percent={(progress.paid / progress.total) * 100} tone={progress.done ? 'positive' : 'accent'} />
              <span className="text-helper text-slate-500">
                {formatCompact(progress.paidAmount)} of {formatCompact(progress.totalPayable)} repaid
                {loan.interestRate != null ? ` · ${loan.interestRate}% a year` : ''}
              </span>
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={item.active}
          aria-label={item.active ? `Pause ${item.name}` : `Resume ${item.name}`}
          onClick={onToggleActive}
          className="flex h-8 items-center"
        >
          <span
            className={clsx(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              item.active ? 'bg-accent' : 'bg-slate-300'
            )}
          >
            <span
              className={clsx(
                'absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                item.active ? 'translate-x-[18px]' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>
        {isOverdue && (
          // An item confirmed before an account was required can still be
          // missing one -- mark-as-paid needs somewhere to log the expense, so
          // route to Edit instead until then.
          <button
            type="button"
            onClick={item.account ? onMarkPaid : onEdit}
            disabled={markPaidPending}
            title={item.account ? 'Logs the expense and moves the next due date forward' : 'Add an account first'}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-app-border px-2.5 text-xs font-semibold text-slate-700 hover:border-positive hover:text-positive disabled:opacity-50"
          >
            <Check size={13} aria-hidden="true" />
            {item.account ? 'Paid' : 'Add account'}
          </button>
        )}
      </div>
    </li>
  )
}
