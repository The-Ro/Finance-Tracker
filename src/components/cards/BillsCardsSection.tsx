import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useCardStatuses } from '@/hooks/useCards'
import { useAccountDetails } from '@/hooks/useLookupLists'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { nextStatementDate } from '@/lib/creditCards'
import { loanDetailsOf } from '@/lib/loans'
import { formatShortDate, todayISO } from '@/lib/format'
import { cardPagePath } from './cardPath'

/**
 * Every open credit card on Bills, kept simple (user: "owed is enough, plus
 * the next statement date"): what's owed, when the next statement comes, a
 * line for EMIs on the card, and -- only while a bill is due -- the bill with
 * Pay. Tap a card for everything else (its page).
 */
export function BillsCardsSection() {
  const statuses = useCardStatuses()
  const { data: details } = useAccountDetails()
  const { data: recurring = [] } = useRecurringItemsRaw()
  const { format } = useFormatCurrency()
  const { openAddEntry } = useGlobalModals()
  const today = todayISO()
  const cards = [...statuses.entries()].sort(([a], [b]) => a.localeCompare(b))
  // Monthly EMI total per card (active loan items charged to it).
  const emiByCard = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recurring) {
      if (r.active && r.account && loanDetailsOf(r)) map.set(r.account, (map.get(r.account) ?? 0) + Number(r.amount))
    }
    return map
  }, [recurring])
  if (cards.length === 0) return null

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-serif text-lg font-semibold text-slate-900">Credit cards</h2>
      <ul className="stagger-rows flex flex-col divide-y divide-app-border">
        {cards.map(([name, s]) => {
          const d = details?.get(name)
          const bill = s.bill
          const due = bill && bill.due > 0 ? bill : null
          const overdue = !!due && due.dueDate < today
          const emi = emiByCard.get(name) ?? 0
          const nextStatement = d?.statementDay ? formatShortDate(nextStatementDate(d.statementDay, today)) : null
          return (
            <li key={name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link to={cardPagePath(name)} className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light">
                  <CreditCard size={18} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                    <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', s.credit > 0 ? 'text-positive' : 'text-slate-900')}>
                      {s.credit > 0 ? `${format(s.credit)} credit` : `${format(s.owed)} owed`}
                    </span>
                  </span>
                  <span className="text-helper text-slate-500">
                    {nextStatement ? `Next statement ${nextStatement}` : 'Add its statement day to see the bill'}
                    {emi > 0 && ` · EMI ${format(emi)}`}
                  </span>
                  {due && (
                    <span className={clsx('text-helper font-medium', overdue ? 'text-danger' : 'text-slate-700')}>
                      Bill {format(due.due)} · {overdue ? 'was due' : 'due'} {formatShortDate(due.dueDate)}
                    </span>
                  )}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
              {due && (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() =>
                    openAddEntry('transfer', { toAccount: name, amount: due.due, merchant: name + ' bill payment', account: d?.payFrom ?? undefined })
                  }
                >
                  Pay
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
