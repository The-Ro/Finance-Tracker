import { useMemo, useState } from 'react'
import { Repeat } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SuggestionCard } from './SuggestionCard'
import { ConfirmedItemRow } from './ConfirmedItemRow'
import { RecurringFormModal } from './RecurringFormModal'
import { useRecurringData, useRecurringMutations, type RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAuth } from '@/context/AuthContext'
import { useAccountBalances } from '@/hooks/useTransactions'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | null>(null)

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={title}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            {addLabel}
          </Button>
        }
      />

      <Card className="flex items-center gap-3 border-accent/20 bg-accent-light p-4">
        <Repeat size={18} className="shrink-0 text-accent-on-light" />
        <p className="text-sm text-slate-700">
          Active detection is scanning your own expense transactions for {kind === 'subscription' ? 'subscriptions' : 'recurring payments'}. Estimated commitment:{' '}
          <span className="font-semibold text-accent-on-light">{format(totals.monthly)}/mo</span> ({format(totals.annual)}/yr)
        </p>
      </Card>

      {!isLoading && suggestions.length > 0 && (
        <div className="flex flex-col gap-3">
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
          <Card className="p-4">
            <ul>
              {confirmed.map((item) => (
                <ConfirmedItemRow
                  key={item.id}
                  item={item}
                  accountBalance={item.account ? accountBalances.get(item.account) ?? 0 : null}
                  onEdit={() => {
                    setEditing(item)
                    setModalOpen(true)
                  }}
                  onDelete={() => remove.mutate(item.id)}
                  onToggleActive={() => update.mutate({ id: item.id, active: !item.active })}
                  onMarkPaid={() => markPaid.mutate(item)}
                  markPaidPending={markPaid.isPending}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>

      <RecurringFormModal open={modalOpen} onClose={() => setModalOpen(false)} kind={kind} editing={editing} />
    </div>
  )
}
