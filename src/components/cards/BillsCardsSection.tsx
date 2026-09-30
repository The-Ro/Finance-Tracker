import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useCardStatuses } from '@/hooks/useCards'
import { useAccountDetails } from '@/hooks/useLookupLists'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { formatShortDate, todayISO } from '@/lib/format'
import { cardPagePath } from './cardPath'

/**
 * Every open credit card on Bills, not only the ones with a bill due: what's
 * owed, the current bill (or that it's paid), and -- when the statement and
 * due days aren't set -- how to get the bill to show. Home's Credit cards card
 * links here, so it has to say something about each card.
 */
export function BillsCardsSection() {
  const statuses = useCardStatuses()
  const { data: details } = useAccountDetails()
  const { format } = useFormatCurrency()
  const { openAddEntry } = useGlobalModals()
  const today = todayISO()
  const cards = [...statuses.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (cards.length === 0) return null

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-serif text-lg font-semibold text-slate-900">Credit cards</h2>
      <ul className="stagger-rows flex flex-col divide-y divide-app-border">
        {cards.map(([name, s]) => {
          const bill = s.bill
          const overdue = !!bill && bill.due > 0 && bill.dueDate < today
          const payFrom = details?.get(name)?.payFrom ?? null
          return (
            <li key={name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link to={cardPagePath(name)} className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light">
                  <CreditCard size={18} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                  <span className="text-helper text-slate-500">
                    {format(s.owed)} owed
                    {s.available !== null && ` · ${format(s.available)} available`}
                  </span>
                  <span
                    className={clsx(
                      'text-helper',
                      !bill ? 'text-slate-500' : overdue ? 'font-medium text-danger' : bill.due > 0 ? 'font-medium text-slate-700' : 'text-positive'
                    )}
                  >
                    {!bill
                      ? 'Add its statement and due days to see the bill'
                      : bill.due > 0
                        ? `Bill ${format(bill.due)} · ${overdue ? 'was due' : 'due'} ${formatShortDate(bill.dueDate)}`
                        : 'Last bill paid'}
                  </span>
                  {payFrom && <span className="text-helper text-slate-500">Paid from {payFrom}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
              {bill && bill.due > 0 && (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => openAddEntry('transfer', { toAccount: name, amount: bill.due, merchant: name + ' bill payment', account: payFrom ?? undefined })}
                >
                  Pay
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {cards.some(([, s]) => !s.bill) && (
        <p className="mt-3 text-helper text-slate-500">
          Set the days in{' '}
          <Link to="/settings/accounts" className="font-medium text-accent-dark hover:underline">
            Settings, Accounts &amp; cards
          </Link>{' '}
          (tap the card).
        </p>
      )}
    </Card>
  )
}
