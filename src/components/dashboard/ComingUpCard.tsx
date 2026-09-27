import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'
import { useCardBills } from '@/hooks/useCards'
import { addDaysISO } from '@/lib/billCalendar'
import { dueWithin } from '@/lib/home'

const MAX_ROWS = 5

interface ComingUpCardProps {
  items: RecurringItem[]
  className?: string
}

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * "Due this week": every active recurring item and subscription due in the
 * next 7 days (projected by cadence, same as the Bills calendar) plus anything
 * already overdue. Read-only -- paying happens on Bills or Recurring.
 */
export function ComingUpCard({ items, className }: ComingUpCardProps) {
  const { format } = useFormatCurrency()
  const today = todayISO()
  const cardBills = useCardBills()
  // Recurring items plus credit-card bills (unpaid statement amount) due within the week.
  const rows = useMemo(() => {
    const weekEnd = addDaysISO(today, 6)
    const merged: { item: { id: string; name: string; amount: number }; date: string; overdue: boolean }[] = [
      ...dueWithin(items, today, 7),
      ...cardBills
        .filter((b) => b.dueDate <= weekEnd)
        .map((b) => ({ item: { id: 'card:' + b.account, name: b.account + ' bill', amount: b.due }, date: b.dueDate, overdue: b.dueDate < today })),
    ]
    return merged.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
  }, [items, cardBills, today])
  const total = rows.reduce((sum, r) => sum + r.item.amount, 0)
  const shown = rows.slice(0, MAX_ROWS)
  const hasItems = items.some((i) => i.active) || cardBills.length > 0

  return (
    <Card className={clsx('flex flex-col gap-3 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Due this week</h3>
          {rows.length > 0 && <p className="text-helper tabular-nums text-slate-500">{format(total)} in total</p>}
        </div>
        <Link
          to="/bills"
          className="-mr-2 flex min-h-[44px] items-center px-2 text-helper font-semibold text-accent-dark hover:underline"
        >
          Calendar
        </Link>
      </div>

      {rows.length === 0 ? (
        hasItems ? (
          <p className="text-sm text-slate-500">Nothing due in the next 7 days.</p>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No bills yet"
            description="Recurring payments and subscriptions you confirm will show up here when they're due."
            action={
              <Link to="/recurring" className="text-helper font-medium text-accent-dark hover:underline">
                Go to Recurring
              </Link>
            }
          />
        )
      ) : (
        <ul className="stagger-rows flex flex-col gap-2.5">
          {shown.map(({ item, date, overdue }) => (
            <li key={`${item.id}-${date}`} className="flex items-center gap-3">
              <div className="flex w-11 shrink-0 flex-col items-center leading-tight">
                <span
                  className={clsx(
                    'text-[11px] font-bold uppercase',
                    overdue ? 'text-danger' : date === today ? 'text-brass' : 'text-slate-500'
                  )}
                >
                  {overdue ? 'Late' : date === today ? 'Today' : weekdayOf(date)}
                </span>
                <span className="font-serif text-xl font-semibold tabular-nums text-slate-900">
                  {Number(date.slice(8, 10))}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                {overdue && (
                  <p className="text-helper font-medium text-danger">Overdue since {formatShortDate(date)}</p>
                )}
              </div>
              <span className="shrink-0 font-serif text-base font-semibold tabular-nums text-slate-900">
                {format(item.amount)}
              </span>
            </li>
          ))}
          {rows.length > MAX_ROWS && (
            <li>
              <Link to="/bills" className="text-helper font-medium text-accent-dark hover:underline">
                +{rows.length - MAX_ROWS} more on the calendar
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  )
}
