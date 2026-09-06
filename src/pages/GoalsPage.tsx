import { useState } from 'react'
import { Target } from 'lucide-react'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormModal } from '@/components/goals/GoalFormModal'

export function GoalsPage() {
  const { data: goals = [], remove } = useGoals()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Goals</h1>
        <Button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Create goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set a savings goal to start tracking progress toward it." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={() => {
                setEditing(g)
                setModalOpen(true)
              }}
              onDelete={() => remove.mutate(g.id)}
            />
          ))}
        </div>
      )}

      <GoalFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  )
}
