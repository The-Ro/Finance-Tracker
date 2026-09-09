import { CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'

interface ConfirmedItemRowProps {
  item: RecurringItem
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onMarkPaid: () => void
  markPaidPending: boolean
}

export function ConfirmedItemRow({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  onMarkPaid,
  markPaidPending,
}: ConfirmedItemRowProps) {
  const { format } = useFormatCurrency()
  // Nothing ever advances next_date automatically (no cron, no matching a
  // logged transaction back to this item) -- once today passes it, it just
  // sits there looking like it's still "coming up" unless flagged here.
  const isOverdue = item.active && item.next_date < todayISO()

  return (
    <li className="flex items-center justify-between gap-3 border-b border-app-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
        <p className="truncate text-helper text-slate-500">
          {item.category} · {item.cadence} ·{' '}
          {isOverdue ? (
            <span className="font-medium text-caution">Overdue since {formatShortDate(item.next_date)}</span>
          ) : (
            <>next {formatShortDate(item.next_date)}</>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{format(item.amount)}</span>
        <label className="flex items-center gap-1 text-helper text-slate-500">
          <input type="checkbox" checked={item.active} onChange={onToggleActive} className="h-3.5 w-3.5" />
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
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-positive-light hover:text-positive disabled:opacity-50"
          >
            <CheckCircle2 size={15} />
          </button>
        )}
        <button
          aria-label="Edit"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil size={14} />
        </button>
        <button
          aria-label="Delete"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}
