import { useMemo, useState } from 'react'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { Plus, Target } from 'lucide-react'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useToast } from '@/context/ToastContext'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormModal } from '@/components/goals/GoalFormModal'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { AddMoneyModal } from '@/components/goals/AddMoneyModal'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { summarizeGoals } from '@/lib/goals'
import { InvestmentsSection } from '@/components/investments/InvestmentsSection'

function GoalsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-[88px] w-full rounded-card" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </Card>
        ))}
      </div>
    </div>
  )
}

function SavedSoFar({ goals }: { goals: readonly Goal[] }) {
  const { format } = useFormatCurrency()
  const summary = summarizeGoals(goals)
  const saved = useAnimatedNumber(summary.saved)
  return (
    <Card className="animate-fade-in-up flex items-center justify-between gap-4 border-caution/30 bg-caution-light p-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-helper font-bold uppercase tracking-[0.12em] text-slate-600">Saved so far</p>
        <p className="truncate font-serif text-3xl font-semibold tabular-nums text-slate-900">{format(saved)}</p>
      </div>
      <p className="shrink-0 text-right text-sm leading-snug text-slate-600">
        of <span className="tabular-nums">{format(summary.target)}</span>
        <br />
        across {summary.count} {summary.count === 1 ? 'goal' : 'goals'}
        {summary.reached > 0 && (
          <>
            <br />
            {summary.reached} reached
          </>
        )}
      </p>
    </Card>
  )
}

export function GoalsPage() {
  const { data: goals = [], remove, isLoading } = useGoals()
  // SIPs and other payments that add to a goal when marked paid.
  const { data: recurring = [] } = useRecurringItemsRaw()
  const feedersByGoal = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; cadence: string; next_date: string }[]>()
    for (const r of recurring) {
      if (!r.active || !r.goal_id) continue
      map.set(r.goal_id, [...(map.get(r.goal_id) ?? []), { name: r.name, amount: Number(r.amount), cadence: r.cadence, next_date: r.next_date }])
    }
    return map
  }, [recurring])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [addingToId, setAddingToId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null)
  // A SIP being set up from a goal's card (opens Recurring's form, linked to the goal).
  const [sipFor, setSipFor] = useState<Goal | null>(null)
  const sipPrefill = useMemo(
    () => (sipFor ? { name: `SIP for ${sipFor.name}`, category: 'Investments', goalId: sipFor.id, investment: true } : null),
    [sipFor]
  )
  const { show } = useToast()
  // Looked up from the live list so the modal always shows the latest saved amount.
  const addingTo = useMemo(() => goals.find((g) => g.id === addingToId) ?? null, [goals, addingToId])

  const confirmDelete = () => {
    if (!pendingDelete) return
    remove.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setPendingDelete(null)
        show("Couldn't delete that goal. Try again.", { tone: 'error' })
      },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Goals & investments" />

      <InvestmentsSection />

      <div className="-mb-1 mt-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Goals</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
          className="press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3.5 text-sm font-semibold text-accent-dark"
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Add goal
        </button>
      </div>
      {isLoading ? (
        <GoalsSkeleton />
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set a savings goal to start tracking progress toward it." />
      ) : (
        <>
          <SavedSoFar goals={goals} />
          <div className="stagger-rows grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => (
              // Wrapper takes the stagger animation: its `both` fill would otherwise
              // pin transform on the card and cancel .card-interactive's hover lift.
              <div key={g.id}>
                <GoalCard
                  goal={g}
                  onEdit={() => {
                    setEditing(g)
                    setModalOpen(true)
                  }}
                  onDelete={() => setPendingDelete(g)}
                  onAddMoney={() => setAddingToId(g.id)}
                  onStartSip={() => setSipFor(g)}
                  feeders={feedersByGoal.get(g.id)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <GoalFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onDelete={() => {
          setModalOpen(false)
          if (editing) setPendingDelete(editing)
        }}
      />
      <AddMoneyModal goal={addingTo} onClose={() => setAddingToId(null)} />
      <RecurringFormModal open={sipFor !== null} onClose={() => setSipFor(null)} kind="recurring" prefill={sipPrefill} />
      <ConfirmDeleteModal
        open={pendingDelete !== null}
        title="Delete goal"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <p>
          Delete the goal <span className="font-medium">{pendingDelete?.name}</span>? Its saved-so-far progress is lost. This
          can't be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  )
}
