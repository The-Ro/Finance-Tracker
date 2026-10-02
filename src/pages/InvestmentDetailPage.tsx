import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft, Target } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useRecurringItemsRaw, useRecurringMutations } from '@/hooks/useRecurring'
import { useGoals } from '@/hooks/useGoals'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import {
  investmentHistory,
  investmentMonthGrid,
  investmentSummary,
  monthYearLabel,
  toggleMissedMonth,
  type MonthCell,
} from '@/lib/investments'
import { formatShortDate, todayISO } from '@/lib/format'

const CADENCE_WORDS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
  quarterly: 'every 3 months',
  'half-yearly': 'every 6 months',
  annual: 'every year',
}

const CELL_STYLE: Record<MonthCell['state'], string> = {
  paid: 'bg-accent dark:bg-accent-dark',
  missed: 'border-[1.5px] border-dashed border-danger bg-danger-light',
  due: 'border-[1.5px] border-brass bg-app-card',
  none: 'bg-slate-100 dark:bg-white/10',
}

/**
 * One investment, tapped: what's been put in since it started (payments
 * before the app included), the month-by-month record -- tap a month to mark
 * it missed or paid -- its goal, and Mark paid when one is due.
 */
export function InvestmentDetailPage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const today = todayISO()
  const { data: recurring = [], isLoading } = useRecurringItemsRaw()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: goals = [] } = useGoals()
  const { update, markPaid } = useRecurringMutations()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const [editing, setEditing] = useState(false)

  const item = recurring.find((r) => r.id === id) ?? null
  const history = item ? investmentHistory(item) : null
  const grid = useMemo(() => (item ? investmentMonthGrid(item, today) : []), [item, today])
  // Without a start month the total comes from logged payments.
  const logged = useMemo(() => (item ? investmentSummary(transactions, [item], today).items[0] : null), [item, transactions, today])
  const putIn = useAnimatedNumber(history ? history.putIn : (logged?.putIn ?? 0))

  if (!isLoading && (!item || !item.is_investment)) return <Navigate to="/goals" replace />
  if (!item) return null

  const goal = goals.find((g) => g.id === item.goal_id) ?? null
  const dues = history?.dues.length ?? 0
  const paid = history ? history.paid : (logged?.payments ?? 0)
  const missed = history ? history.missed.size : 0
  const due = item.active && item.next_date <= today
  const dueMonth = new Date(`${item.next_date}T00:00:00`).toLocaleDateString(undefined, { month: 'long' })

  const tapMonth = (cell: MonthCell) => {
    if (cell.state !== 'paid' && cell.state !== 'missed') return
    update.mutate(
      { id: item.id, missed_dates: toggleMissedMonth(item.missed_dates, cell) },
      { onSuccess: () => show(cell.state === 'missed' ? `${monthYearLabel(cell.month)} marked paid.` : `${monthYearLabel(cell.month)} marked missed.`) }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/goals" className="-mb-1 inline-flex min-h-[40px] w-fit items-center gap-1 text-sm font-semibold text-accent-dark">
        <ChevronLeft size={18} aria-hidden="true" /> Goals &amp; investments
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-serif text-2xl font-semibold text-slate-900">{item.name}</h1>
        <Button variant="secondary" className="shrink-0" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <Card className="animate-fade-in-up flex flex-col gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">Put in so far</p>
          <p className="font-serif text-4xl font-semibold tabular-nums text-slate-900">{format(putIn)}</p>
          <p className="text-helper text-slate-500">
            {item.started_on ? `since ${monthYearLabel(item.started_on)} · ${paid} of ${dues} payments made` : `${paid} ${paid === 1 ? 'payment' : 'payments'} logged`}
          </p>
        </div>
        {history && dues > 0 && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="animate-bar-grow h-full rounded-full bg-accent dark:bg-accent-dark" style={{ width: `${(paid / dues) * 100}%` }} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-500">Each time</p>
            <p className="truncate text-[15px] font-semibold tabular-nums text-slate-900">{format(Number(item.amount))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-500">Next</p>
            <p className="truncate text-[15px] font-semibold text-slate-900">{item.active ? formatShortDate(item.next_date) : 'Paused'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-500">Missed</p>
            <p className={clsx('text-[15px] font-semibold tabular-nums', missed ? 'text-danger' : 'text-slate-900')}>{missed}</p>
          </div>
        </div>
        <p className="-mt-1 text-helper text-slate-500">
          {format(Number(item.amount))} {CADENCE_WORDS[item.cadence]}. This is what you put in, not what it’s worth today.
        </p>
      </Card>

      {history ? (
        <Card className="animate-fade-in-up flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900">Every month</h2>
            <span className="text-helper text-slate-500">Tap a month to fix it</span>
          </div>
          <div className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] gap-1 text-center text-[11px] text-slate-500" aria-hidden="true">
            <span />
            {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
          <div className="stagger-rows flex flex-col gap-1">
            {grid.map((row) => (
              <div key={row.year} className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] items-center gap-1">
                <span className="text-xs font-bold text-slate-600">{row.year}</span>
                {row.cells.map((c) => {
                  const tappable = c.state === 'paid' || c.state === 'missed'
                  return (
                    <button
                      key={c.month}
                      type="button"
                      disabled={!tappable || update.isPending}
                      onClick={() => tapMonth(c)}
                      aria-label={`${monthYearLabel(c.month)}: ${c.state === 'none' ? 'nothing due' : c.state}`}
                      className={clsx('h-7 rounded-md transition-colors duration-200', CELL_STYLE[c.state], tappable && 'press')}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-accent dark:bg-accent-dark" /> Paid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-[1.5px] border-dashed border-danger bg-danger-light" /> Missed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-[1.5px] border-brass" /> Due
            </span>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-3 border-brass/40 bg-brass-light p-4">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">When did it start?</span>
            <span className="block text-helper text-slate-600">Add the month, and every payment since then is counted.</span>
          </span>
          <Button variant="secondary" className="shrink-0" onClick={() => setEditing(true)}>
            Add
          </Button>
        </Card>
      )}

      {goal && (
        <Link to="/goals" className="card-interactive flex items-center gap-3 rounded-card border border-app-border bg-app-card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass-light text-brass">
            <Target size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">Adds to {goal.name}</span>
            <span className="block text-helper text-slate-500">
              {format(goal.current_amount)} of {format(goal.target_amount)}
            </span>
          </span>
        </Link>
      )}

      {due && (
        <Button className="min-h-[52px] w-full text-base" disabled={markPaid.isPending} onClick={() => markPaid.mutate(item)}>
          Mark {dueMonth} paid
        </Button>
      )}

      <RecurringFormModal open={editing} onClose={() => setEditing(false)} kind="recurring" editing={item} />
    </div>
  )
}
