import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Goal } from '@/hooks/useGoals'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { formatDate } from '@/lib/format'

interface GoalCardProps {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
}

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { format } = useFormatCurrency()
  const percent = useAnimatedNumber(goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0)
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  const animatedCurrent = useAnimatedNumber(goal.current_amount)
  const animatedRemaining = useAnimatedNumber(remaining)

  return (
    <Card className="card-interactive flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{goal.name}</p>
          {goal.due_date && <p className="text-helper text-slate-500">Due {formatDate(goal.due_date)}</p>}
        </div>
        <div className="flex gap-1">
          <button
            aria-label="Edit goal"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label="Delete goal"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ProgressBar percent={percent} tone="positive" />
      <p className="text-helper tabular-nums text-slate-500">
        {format(animatedCurrent)} of {format(goal.target_amount)} · {format(animatedRemaining)} to go
      </p>
      {goal.note && <p className="text-helper italic text-slate-400">{goal.note}</p>}
    </Card>
  )
}
