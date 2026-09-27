import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { useCardStatuses, useClosedAccounts } from '@/hooks/useCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { cardLimitTotals, utilizationTone, type UtilizationTone } from '@/lib/cardSummary'
import { formatShortDate } from '@/lib/format'

const BAR_CLASSES: Record<UtilizationTone, string> = {
  positive: 'bg-positive',
  caution: 'bg-caution',
  danger: 'bg-danger',
}

/**
 * Home's "Credit cards" card: per open card, what's used of its limit (bar
 * coloured green / amber / red at 30% and 70%), what's still available and
 * the current bill. A card without a limit just shows what's owed, with a
 * pointer to Settings. Renders nothing when the user has no open cards.
 */
export function CreditCardsCard({ className }: { className?: string }) {
  const { format } = useFormatCurrency()
  const statuses = useCardStatuses()
  const closed = useClosedAccounts()

  const cards = useMemo(
    () =>
      [...statuses]
        .filter(([name]) => !closed.has(name))
        .map(([name, s]) => ({ name, status: s, limit: s.available != null ? s.available + s.owed : null }))
        .sort((a, b) => b.status.owed - a.status.owed || a.name.localeCompare(b.name)),
    [statuses, closed]
  )
  const totals = useMemo(() => cardLimitTotals(cards.map((c) => ({ owed: c.status.owed, limit: c.limit }))), [cards])

  if (cards.length === 0) return null
  const anyLimit = cards.some((c) => c.limit !== null)

  return (
    <Card className={clsx('flex min-w-0 flex-col gap-4 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Credit cards</h3>
          {totals.percent !== null && (
            <p className="text-helper tabular-nums text-slate-500">{Math.round(totals.percent)}% of all limits in use</p>
          )}
        </div>
        <Link
          to="/bills"
          className="-mr-2 flex min-h-[44px] shrink-0 items-center px-2 text-helper font-semibold text-accent-dark hover:underline"
        >
          Bills
        </Link>
      </div>

      <ul className="flex flex-col gap-4">
        {cards.map(({ name, status, limit }, i) => {
          const bill = status.bill && status.bill.due > 0 ? status.bill : null
          const dueText = bill ? `${format(bill.due)} due ${formatShortDate(bill.dueDate)}` : null
          if (limit === null) {
            return (
              <li key={name} className="flex flex-col gap-1 text-sm">
                <span className="truncate font-semibold text-slate-800">{name}</span>
                <p className="text-helper text-slate-500">
                  <span className={clsx('font-semibold tabular-nums', status.owed > 0 ? 'text-danger' : 'text-slate-800')}>
                    {format(status.owed)}
                  </span>{' '}
                  owed ·{' '}
                  <Link to="/settings#account-types" className="font-semibold text-accent-dark hover:underline">
                    add a limit in Settings
                  </Link>
                  {dueText ? ` · ${dueText}` : ''}
                </p>
              </li>
            )
          }
          const percent = status.utilization ?? 0
          const tone = utilizationTone(percent)
          const available = status.available ?? 0
          return (
            <li key={name} className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-slate-800">{name}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-900">{format(status.owed)}</span> / {format(limit)} ·{' '}
                  <span className={clsx('font-semibold', tone === 'danger' ? 'text-danger' : 'text-slate-900')}>{Math.round(percent)}%</span>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`${name}: ${Math.round(percent)}% of limit used`}
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={clsx('animate-bar-grow h-full rounded-full', BAR_CLASSES[tone])}
                  style={{ width: `${Math.max(percent, percent > 0 ? 1 : 0)}%`, animationDelay: `${500 + i * 90}ms` }}
                />
              </div>
              <p className="text-helper tabular-nums text-slate-500">
                {status.credit > 0 ? `${format(status.credit)} credit on the card` : `${format(available)} available`}
                {dueText ? ` · ${dueText}` : ''}
              </p>
            </li>
          )
        })}
      </ul>

      {anyLimit && (
        <p className="mt-auto rounded-xl bg-brass-light px-3.5 py-3 text-helper leading-relaxed text-slate-700">
          Bars turn amber at 30% of a card's limit and red past 70%.
        </p>
      )}
    </Card>
  )
}
