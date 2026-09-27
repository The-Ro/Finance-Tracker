import { useEffect, useState, type ReactNode } from 'react'
import { PartyPopper, Pencil, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import type { Goal } from '@/hooks/useGoals'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { formatDate, toLocalISODate, todayISO } from '@/lib/format'
import { goalPace, goalPercent, isGoalReached, markGoalCelebrated, readCelebratedGoals } from '@/lib/goals'
import { GoalRing } from './GoalRing'

interface GoalCardProps {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
  onAddMoney: () => void
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function GoalCard({ goal, onEdit, onDelete, onAddMoney }: GoalCardProps) {
  const { format } = useFormatCurrency()
  const reached = isGoalReached(goal)
  const percent = goalPercent(goal)
  const animatedCurrent = useAnimatedNumber(goal.current_amount)

  // created_at is a timestamp; the straight-line "on track" check wants the
  // local calendar day it was created on.
  const startDate = goal.created_at ? toLocalISODate(new Date(goal.created_at)) : null
  const pace = goalPace({ ...goal, start_date: startDate }, todayISO())

  // The "Goal reached" badge pops in once per goal (per browser), then just sits there.
  const [celebrate] = useState(() => reached && !readCelebratedGoals().has(goal.id))
  const [justReached, setJustReached] = useState(false)
  const [wasReached, setWasReached] = useState(reached)
  if (reached !== wasReached) {
    setWasReached(reached)
    if (reached && !readCelebratedGoals().has(goal.id)) setJustReached(true)
  }
  const popBadge = celebrate || justReached
  useEffect(() => {
    if (reached && popBadge) markGoalCelebrated(goal.id)
  }, [reached, popBadge, goal.id])

  let paceLine: ReactNode
  switch (pace.kind) {
    case 'reached':
      paceLine = <span className="text-slate-500">{goal.due_date ? `Reached · target was ${formatDate(goal.due_date)}` : 'Fully funded'}</span>
      break
    case 'no-date':
      paceLine = <span className="text-slate-500">No target date · {format(pace.remaining)} to go</span>
      break
    case 'overdue':
      paceLine = (
        <span className="text-danger">
          Target date {formatDate(goal.due_date!)} passed · {format(pace.remaining)} to go
        </span>
      )
      break
    case 'scheduled':
      paceLine = (
        <span className="text-slate-500">
          {format(pace.monthly)} a month reaches it by {monthYear(goal.due_date!)} ·{' '}
          <span className={clsx('font-semibold', pace.onTrack ? 'text-positive' : 'text-danger')}>
            {pace.onTrack ? 'on track' : 'behind'}
          </span>
        </span>
      )
      break
  }

  return (
    <Card className="card-interactive flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-4">
        <GoalRing percent={percent} reached={reached} label={`${goal.name} progress`} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[15px] font-bold text-slate-900">{goal.name}</p>
          <p className="text-sm tabular-nums text-slate-600">
            {format(animatedCurrent)} of {format(goal.target_amount)}
          </p>
          <p className="text-helper">{paceLine}</p>
        </div>
        <button
          type="button"
          aria-label={`Add money to ${goal.name}`}
          onClick={onAddMoney}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-border text-slate-700 transition-colors hover:bg-slate-100 active:scale-[0.97]"
        >
          <Plus size={18} strokeWidth={2.2} />
        </button>
      </div>

      {goal.note && <p className="text-helper italic text-slate-500">{goal.note}</p>}

      <div className="-mb-2 -mr-2 mt-auto flex items-center justify-between gap-2">
        {reached ? (
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full bg-caution-light px-2.5 py-1 text-helper font-semibold text-slate-900',
              popBadge && 'animate-pop-in'
            )}
          >
            <PartyPopper size={14} aria-hidden="true" className="text-caution" />
            Goal reached
          </span>
        ) : (
          <span />
        )}
        <div className="flex">
          <button
            type="button"
            aria-label={`Edit ${goal.name}`}
            onClick={onEdit}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${goal.name}`}
            onClick={onDelete}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-danger-light hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </Card>
  )
}
