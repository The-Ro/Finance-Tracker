import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSplitMutations, useSplits } from '@/hooks/useSplits'
import { useProfiles } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAuth } from '@/context/AuthContext'
import { splitBalances } from '@/lib/splits'
import { formatShortDate } from '@/lib/format'

/**
 * Split and settle up: who owes whom across split expenses. Only the payer can
 * mark a split settled (RLS) -- they're the one who knows the money arrived.
 */
export function SharedPage() {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { data: splits = [], isLoading } = useSplits()
  const { data: profiles = {} } = useProfiles()
  const { setSettled } = useSplitMutations()
  const balances = useMemo(() => (userId ? splitBalances(splits, userId) : []), [splits, userId])

  const name = (id: string) => profiles[id]?.displayName || profiles[id]?.email || 'Unknown user'

  if (!isLoading && splits.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Shared" />
        <EmptyState
          icon={Users}
          title="No split expenses yet"
          description="Split one of your expenses with someone you share with from its row on the Transactions page, and it shows up here."
          action={
            <Link to="/transactions" className="text-helper font-medium text-accent-dark hover:underline">
              Go to Transactions
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Shared" />

      {balances.length > 0 && (
        <div className="stagger-rows grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {balances.map((b) => (
            <Card key={b.userId} className="flex items-center gap-4 p-5">
              <Avatar avatar={profiles[b.userId]?.avatar ?? null} name={name(b.userId)} size={48} />
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-600">
                  {b.net === 0 ? `You and ${name(b.userId)} are even` : b.net > 0 ? `${name(b.userId)} owes you` : `You owe ${name(b.userId)}`}
                </p>
                <p className={clsx('font-serif text-2xl font-semibold', b.net > 0 ? 'text-positive' : b.net < 0 ? 'text-danger' : 'text-slate-900')}>
                  {format(Math.abs(b.net))}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Split expenses</h2>
        <ul className="stagger-rows flex flex-col">
          {splits.map((s) => {
            const iPaid = s.owner_user_id === userId
            const other = iPaid ? s.with_user_id : s.owner_user_id
            return (
              <li key={s.id} className="flex items-center gap-3 border-b border-app-border py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className={clsx('truncate text-sm font-semibold', s.settled_at ? 'text-slate-400 line-through' : 'text-slate-900')}>
                    {s.description}
                  </p>
                  <p className="text-helper text-slate-500">
                    {formatShortDate(s.date)} · {iPaid ? `${name(other)} owes you` : `You owe ${name(other)}`}
                    {s.settled_at ? ' · settled' : ''}
                  </p>
                </div>
                <span className={clsx('font-serif text-base font-semibold', iPaid ? 'text-positive' : 'text-danger')}>
                  {format(s.amount)}
                </span>
                {iPaid && (
                  <button
                    type="button"
                    onClick={() => setSettled.mutate({ id: s.id, settled: !s.settled_at })}
                    disabled={setSettled.isPending}
                    className="min-h-[36px] rounded-full border border-app-border px-3 text-helper font-medium text-slate-600 hover:border-accent hover:text-accent-dark"
                  >
                    {s.settled_at ? 'Undo' : 'Mark settled'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
