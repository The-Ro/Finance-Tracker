import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Budget } from '@/hooks/useBudgets'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

interface BudgetCardProps {
  budget: Budget
  spent: number
  onEdit: () => void
  onDelete: () => void
}

export function BudgetCard({ budget, spent, onEdit, onDelete }: BudgetCardProps) {
  const { format } = useFormatCurrency()
  const remaining = budget.monthly_limit - spent
  const percent = budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0
  const overBudget = spent > budget.monthly_limit

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{budget.category}</p>
          <p className="text-helper text-slate-500">
            {format(spent)} of {format(budget.monthly_limit)}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            aria-label="Edit budget"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label="Delete budget"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ProgressBar percent={percent} tone={overBudget ? 'danger' : 'accent'} />
      <p className={'text-helper ' + (overBudget ? 'font-medium text-red-600' : 'text-slate-500')}>
        {overBudget
          ? `${format(Math.abs(remaining))} over budget`
          : `${format(remaining)} remaining`}
      </p>
    </Card>
  )
}
