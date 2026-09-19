import { useState } from 'react'
import { Target } from 'lucide-react'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormModal } from '@/components/goals/GoalFormModal'

function GoalsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-36" />
        </Card>
      ))}
    </div>
  )
}

export function GoalsPage() {
  const { data: goals = [], remove, isLoading } = useGoals()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Goals"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            Create goal
          </Button>
        }
      />

      {isLoading ? (
        <GoalsSkeleton />
      ) : goals.length === 0 ? (
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
