import { useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBudgets, type Budget } from '@/hooks/useBudgets'
import { useMyTransactions } from '@/hooks/useTransactions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal'
import { resolvePeriod, isWithinRange } from '@/lib/period'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

export function BudgetsPage() {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { data: budgets = [], remove } = useBudgets()
  const myTransactions = useMyTransactions(userId)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)

  const thisMonthRange = resolvePeriod('this-month')
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of myTransactions.data ?? []) {
      if (t.type !== 'expense' || !isWithinRange(t.date, thisMonthRange)) continue
      map.set(t.category!, (map.get(t.category!) ?? 0) + t.amount)
    }
    return map
  }, [myTransactions.data, thisMonthRange])

  const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + (spentByCategory.get(b.category) ?? 0), 0)
  const healthPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Budgets</h1>
        <Button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Create budget
        </Button>
      </div>

      {budgets.length === 0 ? (
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
                onEdit={() => {
                  setEditing(b)
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
