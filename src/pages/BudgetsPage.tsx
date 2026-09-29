import { useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { applyRollover, useBudgets, type Budget } from '@/hooks/useBudgets'
import { useMyTransactions } from '@/hooks/useTransactions'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useToast } from '@/context/ToastContext'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal'
import { resolvePeriod } from '@/lib/period'
import { priorMonthResult, spendByCategory } from '@/lib/budgets'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

function BudgetsSkeleton() {
  return (
    <>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
    </>
  )
}

export function BudgetsPage() {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { data: rawBudgets = [], remove, isLoading } = useBudgets()
  const myTransactions = useMyTransactions(userId)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null)
  const { show } = useToast()

  const confirmDelete = () => {
    if (!pendingDelete) return
    remove.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setPendingDelete(null)
        show("Couldn't delete that budget. Try again.", { tone: 'error' })
      },
    })
  }

  const lastMonthRange = useMemo(() => resolvePeriod('last-month'), [])
  const spentByCategory = useMemo(
    () => spendByCategory(myTransactions.data ?? [], resolvePeriod('this-month')),
    [myTransactions.data]
  )
  const spentLastMonthByCategory = useMemo(
    () => spendByCategory(myTransactions.data ?? [], lastMonthRange),
    [myTransactions.data, lastMonthRange]
  )

  const budgets = useMemo(() => applyRollover(rawBudgets, myTransactions.data ?? []), [rawBudgets, myTransactions.data])

  const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + (spentByCategory.get(b.category) ?? 0), 0)
  const healthPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budgets"
        actions={
          <PageHeaderAction
            label="New budget"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          />
        }
      />

      {isLoading ? (
        <BudgetsSkeleton />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Create a monthly budget for a category to track your spending against it."
        />
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-helper font-medium uppercase tracking-wide text-slate-500">All budgets · this month</p>
                <p className="mt-1 font-serif text-2xl font-semibold tabular-nums text-slate-900">{format(totalSpent)}</p>
                <p className="text-sm tabular-nums text-slate-500">spent of {format(totalLimit)}</p>
              </div>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2.5 py-1 text-helper font-semibold tabular-nums',
                  totalSpent > totalLimit ? 'bg-danger-light text-danger' : 'bg-positive-light text-positive'
                )}
              >
                {totalSpent > totalLimit ? `${format(totalSpent - totalLimit)} over` : `${format(totalLimit - totalSpent)} left`}
              </span>
            </div>
            <ProgressBar percent={healthPercent} tone={healthPercent > 100 ? 'danger' : 'positive'} />
          </Card>

          <div className="stagger-rows grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={b}
                spent={spentByCategory.get(b.category) ?? 0}
                lastMonth={priorMonthResult(
                  b.baseLimit,
                  b.created_at,
                  spentLastMonthByCategory.get(b.category) ?? 0,
                  lastMonthRange
                )}
                onEdit={() => {
                  setEditing({ ...b, monthly_limit: b.baseLimit })
                  setModalOpen(true)
                }}
                onDelete={() => setPendingDelete(b)}
              />
            ))}
          </div>
        </>
      )}

      <BudgetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onDelete={() => {
          setModalOpen(false)
          if (editing) setPendingDelete(editing)
        }}
      />
      <ConfirmDeleteModal
        open={pendingDelete !== null}
        title="Delete budget"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <p>
          Delete the <span className="font-medium">{pendingDelete?.category}</span> budget? Your transactions aren't affected.
        </p>
      </ConfirmDeleteModal>
    </div>
  )
}
