import { useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { applyRollover, useBudgets, type Budget } from '@/hooks/useBudgets'
import { useMyTransactions } from '@/hooks/useTransactions'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
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
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            Create budget
          </Button>
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
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Overall budget health (this month)</span>
              <span className="text-slate-500">
                {format(totalSpent)} / {format(totalLimit)}
              </span>
            </div>
            <ProgressBar percent={healthPercent} tone={healthPercent > 100 ? 'danger' : 'positive'} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                onDelete={() => remove.mutate(b.id)}
              />
            ))}
          </div>
        </>
      )}

      <BudgetFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  )
}
