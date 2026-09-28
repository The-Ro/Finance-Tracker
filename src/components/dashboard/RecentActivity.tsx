import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import type { Transaction } from '@/hooks/useTransactions'
import type { ProfileMap } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'
import { useDebitCards } from '@/hooks/useDebitCards'
import { debitCardLabel } from '@/lib/debitCards'

const COLLAPSED_ROWS = 5
const EXPANDED_ROWS = 15

interface RecentActivityProps {
  title: string
  transactions: Transaction[]
  showOwner?: boolean
  profiles?: ProfileMap
  emptyDescription: string
}

export function RecentActivity({ title, transactions, showOwner, profiles, emptyDescription }: RecentActivityProps) {
  const { formatSigned } = useFormatCurrency()
  const { data: debitCards = [] } = useDebitCards()
  const cardsById = new Map(debitCards.map((c) => [c.id, c]))
  // Five at first; See more shows up to 15, then Activity has the rest.
  const [expanded, setExpanded] = useState(false)
  const items = transactions.slice(0, expanded ? EXPANDED_ROWS : COLLAPSED_ROWS)

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="Nothing here yet" description={emptyDescription} />
      ) : (
        <ul className="stagger-rows flex flex-col gap-3">
          {items.map((t) => {
            const owner = profiles?.[t.owner_user_id]
            const card = t.debit_card_id ? cardsById.get(t.debit_card_id) : undefined
            return (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {showOwner && owner && <Avatar avatar={owner.avatar} name={owner.displayName} size={24} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.merchant}</p>
                    <p className="truncate text-helper text-slate-500">
                      {formatShortDate(t.date)} · {t.type === 'transfer' ? 'Transfer' : t.category} ·{' '}
                      {card ? debitCardLabel(card) : t.account}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    'shrink-0 text-sm font-semibold ' + (t.type === 'income' ? 'text-positive' : 'text-slate-900')
                  }
                >
                  {formatSigned(t.amount, t.type)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {transactions.length > COLLAPSED_ROWS && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-app-border pt-1">
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="-mx-2 flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-accent-dark hover:bg-slate-50"
            >
              See more
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="-mx-2 flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Show fewer
            </button>
          )}
          <Link
            to="/transactions"
            className="-mx-2 flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent-dark hover:bg-slate-50"
          >
            All activity <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  )
}
