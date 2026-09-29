import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Repeat } from 'lucide-react'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useToast } from '@/context/ToastContext'
import { SuggestionCard } from './SuggestionCard'
import { ConfirmedItemRow } from './ConfirmedItemRow'
import { RecurringFormModal } from './RecurringFormModal'
import { useRecurringData, useRecurringMutations, type RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAuth } from '@/context/AuthContext'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useAccountKinds } from '@/hooks/useCards'
import { useCategories } from '@/hooks/useLookupLists'
import { accountShortfalls } from '@/lib/recurringShortfall'
import type { RecurringKind } from '@/types/database.types'

interface RecurringLikePageProps {
  kind: RecurringKind
  title: string
  addLabel: string
  emptyDescription: string
}

export function RecurringLikePage({ kind, title, addLabel, emptyDescription }: RecurringLikePageProps) {
  const { isLoading, confirmed, suggestions } = useRecurringData(kind)
  const { keep, ignore, update, remove, markPaid } = useRecurringMutations()
  const { format } = useFormatCurrency()
  const { userId } = useAuth()
  const accountBalances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const { icons: categoryIcons } = useCategories()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RecurringItem | null>(null)
  const { show } = useToast()

  const confirmDelete = () => {
    if (!pendingDelete) return
    remove.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setPendingDelete(null)
        show("Couldn't delete that item. Try again.", { tone: 'error' })
      },
    })
  }

  const totals = useMemo(() => {
    const activeConfirmed = confirmed.filter((c) => c.active)
    const confirmedMonthly = activeConfirmed.reduce((sum, c) => {
      const monthly =
        c.cadence === 'weekly'
          ? (c.amount * 52) / 12
          : c.cadence === 'biweekly'
          ? (c.amount * 26) / 12
          : c.cadence === 'quarterly'
          ? c.amount / 3
          : c.cadence === 'half-yearly'
          ? c.amount / 6
          : c.cadence === 'annual'
          ? c.amount / 12
          : c.amount
      return sum + monthly
    }, 0)
    const suggestedMonthly = suggestions.reduce((sum, s) => sum + s.monthlyEquivalent, 0)
    return { monthly: confirmedMonthly + suggestedMonthly, annual: (confirmedMonthly + suggestedMonthly) * 12 }
  }, [confirmed, suggestions])

  // One heads-up per account that can't cover its items' next payments,
  // instead of the same sentence under every row. Credit cards aren't funded.
  const shortfalls = useMemo(
    () => accountShortfalls(confirmed, accountBalances, (a) => kinds.get(a) !== 'credit_card'),
    [confirmed, accountBalances, kinds]
  )
  const shortAccounts = new Set(shortfalls.map((s) => s.account))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={title}
        actions={
          <PageHeaderAction
            label={addLabel}
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          />
        }
      />

      <Card className="flex items-center gap-3 border-accent/20 bg-accent-light p-4">
        <Repeat size={18} className="shrink-0 text-accent-on-light" />
        <p className="text-sm text-slate-700">
          About <span className="font-semibold text-accent-on-light">{format(totals.monthly)} a month</span>{' '}
          ({format(totals.annual)} a year) goes to {kind === 'subscription' ? 'subscriptions' : 'regular payments'}. We also
          look through your spending for new ones.
        </p>
      </Card>

      {!isLoading && suggestions.length > 0 && (
        <div className="stagger-rows flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Suggestions</h2>
          {suggestions.map((c) => (
            <SuggestionCard
              key={c.patternKey}
              candidate={c}
              busy={keep.isPending || ignore.isPending}
              onKeep={() => keep.mutate(c)}
              onIgnore={() => ignore.mutate(c.patternKey)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Confirmed</h2>
        {confirmed.length === 0 ? (
          <EmptyState icon={Repeat} title="Nothing confirmed yet" description={emptyDescription} />
        ) : (
          <>
          {shortfalls.map((s) => (
            <div
              key={s.account}
              role="status"
              className="animate-fade-in-up flex items-start gap-2.5 rounded-xl bg-caution-light px-3 py-2.5 text-helper text-slate-700"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-caution" aria-hidden="true" />
              <p className="min-w-0">
                Not enough money in <span className="font-semibold text-slate-800">{s.account}</span>. It has{' '}
                {format(s.balance)}, but {s.count === 1 ? 'the next payment needs' : `the next ${s.count} payments need`}{' '}
                {format(s.needed)}.{' '}
                <Link to="/settings/accounts#starting-balances" className="font-semibold text-accent-dark hover:underline">
                  Update balance
                </Link>
              </p>
            </div>
          ))}
          <Card className="px-4 py-1">
            <ul className="stagger-rows flex flex-col divide-y divide-app-border">
              {confirmed.map((item) => (
                <ConfirmedItemRow
                  key={item.id}
                  item={item}
                  iconKey={categoryIcons.get(item.category)}
                  lowBalance={item.active && !!item.account && shortAccounts.has(item.account)}
                  onEdit={() => {
                    setEditing(item)
                    setModalOpen(true)
                  }}
                  onToggleActive={() => update.mutate({ id: item.id, active: !item.active })}
                  onMarkPaid={() => markPaid.mutate(item)}
                  markPaidPending={markPaid.isPending}
                />
              ))}
            </ul>
          </Card>
          </>
        )}
      </div>

      <RecurringFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        kind={kind}
        editing={editing}
        onDelete={
          editing
            ? () => {
                setModalOpen(false)
                setPendingDelete(editing)
              }
            : undefined
        }
      />
      <ConfirmDeleteModal
        open={pendingDelete !== null}
        title={kind === 'subscription' ? 'Delete subscription' : 'Delete recurring payment'}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <p>
          Delete <span className="font-medium">{pendingDelete?.name}</span>? Past transactions stay; it just stops being
          tracked. This can't be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  )
}
