import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useOverdueRecurringItems, useRecurringMutations } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'

/** Recurring bills and subscriptions past their next_date -- surfaced in the
 *  notification bell so an overdue payment doesn't just sit quietly on the
 *  Recurring/Subscriptions page until someone happens to visit it. */
export function OverdueRecurringAlerts() {
  const overdue = useOverdueRecurringItems()
  const { markPaid } = useRecurringMutations()
  const { format } = useFormatCurrency()

  // In the notification dropdown specifically, an empty section is just
  // noise once something else in the panel actually needs attention -- the
  // dropdown's own "you're all caught up" state already covers full-empty.
  if (overdue.length === 0) return null

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Overdue payments</h3>
        <p className="mt-1 text-helper text-slate-500">Recurring bills and subscriptions past their due date.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {overdue.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <Link
              to={item.kind === 'subscription' ? '/subscriptions' : '/recurring'}
              className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"
            >
              <AlertCircle size={14} className="shrink-0 text-caution" />
              <span className="truncate font-medium text-slate-800">{item.name}</span>
              <span className="shrink-0 text-helper text-caution">since {formatShortDate(item.next_date)}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{format(item.amount)}</span>
              {item.account ? (
                <button
                  type="button"
                  aria-label={`Mark ${item.name} as paid`}
                  title="Mark as paid -- logs the expense and moves the next due date forward"
                  onClick={() => markPaid.mutate(item)}
                  disabled={markPaid.isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-positive-light hover:text-positive disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                </button>
              ) : (
                // An item confirmed before an account was required (or one
                // that's never had it filled in) has nothing to log the
                // expense against -- previously this just rendered nothing
                // here, which looked identical to "mark as paid" being
                // broken. This makes the reason visible and gives a way out.
                <Link
                  to={item.kind === 'subscription' ? '/subscriptions' : '/recurring'}
                  title="Add an account to this item (Edit) before marking it paid"
                  className="text-helper font-medium text-accent hover:underline"
                >
                  Add account
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
