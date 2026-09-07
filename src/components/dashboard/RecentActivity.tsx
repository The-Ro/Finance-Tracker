import { Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import type { Transaction } from '@/hooks/useTransactions'
import type { ProfileMap } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'

interface RecentActivityProps {
  title: string
  transactions: Transaction[]
  showOwner?: boolean
  profiles?: ProfileMap
  emptyDescription: string
}

export function RecentActivity({ title, transactions, showOwner, profiles, emptyDescription }: RecentActivityProps) {
  const { formatSigned } = useFormatCurrency()
  const items = transactions.slice(0, 5)

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="Nothing here yet" description={emptyDescription} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((t) => {
            const owner = profiles?.[t.owner_user_id]
            return (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {showOwner && owner && <Avatar avatar={owner.avatar} name={owner.displayName} size={24} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.merchant}</p>
                    <p className="truncate text-helper text-slate-500">
                      {formatShortDate(t.date)} · {t.type === 'transfer' ? 'Transfer' : t.category} · {t.account}
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
    </Card>
  )
}
