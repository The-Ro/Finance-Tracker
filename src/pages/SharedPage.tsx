import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Equal, Users } from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSplitMutations, useSplits } from '@/hooks/useSplits'
import { useProfiles } from '@/hooks/useProfiles'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { personSplitSummary, splitBalances, type PersonBalance } from '@/lib/splits'
import { formatShortDate } from '@/lib/format'
import { shareText } from '@/lib/share'

interface SettleTarget {
  userId: string
  ids: string[]
  amount: number
}

/**
 * Split and settle up: who owes whom across split expenses. Only the payer can
 * mark a split settled (RLS) -- they're the one who knows the money arrived.
 */
export function SharedPage() {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const { data: splits = [], isLoading } = useSplits()
  const { data: profiles = {} } = useProfiles()
  // The payer's full expense amount ("You paid ₹3,200") lives on their own
  // transaction; the split row only carries the share owed. Only needed for
  // splits I paid, so my own (already cached app-wide) transactions suffice.
  const { data: myTransactions = [] } = useMyTransactions(userId)
  const { setSettled, settleMany } = useSplitMutations()
  const [confirm, setConfirm] = useState<SettleTarget | null>(null)

  const balances = useMemo(() => (userId ? splitBalances(splits, userId) : []), [splits, userId])
  const paidTotals = useMemo(() => {
    const ids = new Set(splits.map((s) => s.transaction_id))
    const map = new Map<string, number>()
    for (const t of myTransactions) if (ids.has(t.id)) map.set(t.id, t.amount)
    return map
  }, [splits, myTransactions])

  const name = (id: string) => profiles[id]?.displayName || profiles[id]?.email || 'Unknown user'
  const firstName = (id: string) => name(id).split(/[\s@]/)[0] || name(id)

  const settleAll = () => {
    if (!confirm) return
    const who = firstName(confirm.userId)
    settleMany.mutate(confirm.ids, {
      onSuccess: (count) => {
        setConfirm(null)
        show(count === 1 ? `Settled 1 expense with ${who}.` : `Settled ${count} expenses with ${who}.`)
      },
      onError: () => show('Could not settle those expenses. Try again.', { tone: 'error' }),
    })
  }

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

      {balances.length > 0 && userId && (
        <div className="stagger-rows grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {balances.map((b) => (
            <PersonCard
              key={b.userId}
              balance={b}
              meName={name(userId)}
              meAvatar={profiles[userId]?.avatar ?? null}
              theirName={name(b.userId)}
              theirFirstName={firstName(b.userId)}
              theirAvatar={profiles[b.userId]?.avatar ?? null}
              summary={personSplitSummary(splits, userId, b.userId)}
              format={format}
              busy={settleMany.isPending}
              onSettleAll={(ids) => setConfirm({ userId: b.userId, ids, amount: b.owedToMe })}
            />
          ))}
        </div>
      )}

      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Split expenses</h2>
        <ul className="stagger-rows flex flex-col">
          {splits.map((s) => {
            const iPaid = s.owner_user_id === userId
            const other = iPaid ? s.with_user_id : s.owner_user_id
            const total = iPaid ? paidTotals.get(s.transaction_id) : undefined
            const who = firstName(other)
            return (
              <li key={s.id} className="flex items-start gap-3 border-b border-app-border py-3 last:border-b-0 sm:items-center">
                <span
                  aria-hidden="true"
                  className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-semibold',
                    s.settled_at ? 'bg-slate-100 text-slate-400' : 'bg-accent-light text-accent-on-light'
                  )}
                >
                  {s.description.trim().charAt(0).toUpperCase() || '?'}
                </span>
                {/* Phones: details take the full width, then amount + action
                    share a line below. From sm it's one row as before. */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <p className={clsx('truncate text-sm font-semibold', s.settled_at ? 'text-slate-400 line-through' : 'text-slate-900')}>
                      {s.description}
                    </p>
                    <p className="text-helper text-slate-500">
                      {iPaid
                        ? `You paid${total !== undefined ? ` ${format(total)}` : ''} · ${who} owes ${format(s.amount)}`
                        : `${who} paid · you owe ${format(s.amount)}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatShortDate(s.date)}
                      {s.settled_at ? ' · settled' : ''}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:flex-none">
                    <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
                      <span className="text-xs text-slate-500">{iPaid ? 'you lent' : 'you owe'}</span>
                      <span
                        className={clsx(
                          'font-serif text-base font-semibold tabular-nums',
                          s.settled_at ? 'text-slate-400' : iPaid ? 'text-positive' : 'text-danger'
                        )}
                      >
                        {format(s.amount)}
                      </span>
                    </div>
                    {iPaid && (
                      <button
                        type="button"
                        onClick={() => setSettled.mutate({ id: s.id, settled: !s.settled_at })}
                        disabled={setSettled.isPending}
                        className="min-h-[44px] shrink-0 rounded-full border border-app-border px-3 text-helper font-medium text-slate-600 hover:border-accent hover:text-accent-dark disabled:opacity-50"
                      >
                        {s.settled_at ? 'Undo' : 'Mark settled'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => !settleMany.isPending && setConfirm(null)}
        title={confirm ? `Settle up with ${firstName(confirm.userId)}?` : 'Settle up'}
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={settleMany.isPending}>
              Cancel
            </Button>
            <Button onClick={settleAll} disabled={settleMany.isPending}>
              {settleMany.isPending ? 'Settling…' : 'Settle all'}
            </Button>
          </div>
        }
      >
        {confirm && (
          <p className="text-sm text-slate-600">
            This marks {confirm.ids.length === 1 ? 'the 1 expense' : `all ${confirm.ids.length} expenses`}{' '}
            {name(confirm.userId)} owes you for ({format(confirm.amount)}) as paid back. You can undo any of them from
            the list afterwards.
          </p>
        )}
      </Modal>
    </div>
  )
}

interface PersonCardProps {
  balance: PersonBalance
  meName: string
  meAvatar: string | null
  theirName: string
  theirFirstName: string
  theirAvatar: string | null
  summary: { count: number; settleableIds: string[] }
  format: (n: number) => string
  busy: boolean
  onSettleAll: (ids: string[]) => void
}

function PersonCard({
  balance: b,
  meName,
  meAvatar,
  theirName,
  theirFirstName,
  theirAvatar,
  summary,
  format,
  busy,
  onSettleAll,
}: PersonCardProps) {
  const FlowIcon = b.net > 0 ? ArrowLeft : b.net < 0 ? ArrowRight : Equal
  const canSettle = summary.settleableIds.length > 0
  const { show } = useToast()
  // Hands a reminder to the user's own apps (share sheet / clipboard) -- LedgeEaze sends no messages itself.
  const remind = async (text: string) => {
    const result = await shareText('Reminder', text)
    if (result === 'copied') show('Reminder copied. Paste it into a message.')
    else if (result === 'failed') show('Could not share the reminder.', { tone: 'error' })
  }
  return (
    <Card className="flex flex-col items-center gap-3 p-5 text-center">
      <div className="flex items-center gap-3">
        <Avatar avatar={meAvatar} name={meName} size={48} />
        <FlowIcon
          size={22}
          aria-hidden="true"
          className={clsx('shrink-0', b.net > 0 ? 'text-positive' : b.net < 0 ? 'text-danger' : 'text-slate-400')}
        />
        <Avatar avatar={theirAvatar} name={theirName} size={48} />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="max-w-full truncate text-sm text-slate-600">
          {b.net === 0 ? `You and ${theirName} are even` : b.net > 0 ? `${theirName} owes you` : `You owe ${theirName}`}
        </p>
        <p
          className={clsx(
            'font-serif text-3xl font-semibold tabular-nums',
            b.net > 0 ? 'text-positive' : b.net < 0 ? 'text-danger' : 'text-slate-900'
          )}
        >
          {format(Math.abs(b.net))}
        </p>
        <p className="text-helper text-slate-500">
          From {summary.count} shared {summary.count === 1 ? 'expense' : 'expenses'}
        </p>
      </div>
      {canSettle ? (
        <div className="flex w-full flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                remind(
                  `Hi ${theirFirstName}, a quick reminder: you owe me ${format(b.owedToMe)} for ${summary.settleableIds.length} shared ${summary.settleableIds.length === 1 ? 'expense' : 'expenses'}. Thanks!`
                )
              }
            >
              Remind
            </Button>
            <Button onClick={() => onSettleAll(summary.settleableIds)} disabled={busy}>
              Settle all
            </Button>
          </div>
          {b.iOwe > 0 && (
            <p className="text-helper text-slate-500">
              Settles the {format(b.owedToMe)} {theirFirstName} owes you. {theirFirstName} marks the {format(b.iOwe)} you owe
              as settled.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-helper text-slate-600">
          {theirFirstName} paid for these, so {theirFirstName} marks them settled once you've paid them back.
        </p>
      )}
    </Card>
  )
}
