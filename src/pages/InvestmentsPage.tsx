import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Flame, Info, Sparkles, Target, TrendingUp } from 'lucide-react'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useRecurringItemsRaw, useRecurringMutations } from '@/hooks/useRecurring'
import { useGoals } from '@/hooks/useGoals'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { investmentSummary, looksLikeInvestment, INVEST_TAG } from '@/lib/investments'
import { formatShortDate, todayISO } from '@/lib/format'
import type { RecurringItem } from '@/hooks/useRecurring'

const CADENCE_WORDS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
  quarterly: 'every 3 months',
  'half-yearly': 'every 6 months',
  annual: 'every year',
}

function monthLabel(key: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts)
}

/**
 * Investments: what you put into SIPs, RDs, PPF and the like, built from
 * recurring payments marked "This is an investment" (and any entry tagged
 * #invest). It counts money put in -- it never knows what the funds are worth.
 */
export function InvestmentsPage() {
  const { userId } = useAuth()
  const today = todayISO()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: recurring = [] } = useRecurringItemsRaw()
  const { data: goals = [] } = useGoals()
  const { markPaid, update } = useRecurringMutations()
  const { format, formatCompact } = useFormatCurrency()
  const { show } = useToast()
  const [editing, setEditing] = useState<RecurringItem | null>(null)
  const [adding, setAdding] = useState(false)

  const s = useMemo(() => investmentSummary(transactions, recurring, today), [transactions, recurring, today])
  const total = useAnimatedNumber(s.total)
  const byId = useMemo(() => new Map(recurring.map((r) => [r.id, r])), [recurring])
  const goalName = (id: string | null) => goals.find((g) => g.id === id)?.name ?? null
  // Recurring payments whose name says SIP/PPF/... but aren't marked yet.
  const maybe = recurring.filter((r) => r.kind === 'recurring' && !r.is_investment && looksLikeInvestment(r.name))
  const chartMax = Math.max(1, s.monthlyPlan, ...s.byMonth.map((m) => m.amount))
  const sipPrefill = useMemo(() => ({ name: '', investment: true }), [])
  const empty = s.items.length === 0 && s.total === 0
  const activePlans = s.items.filter((i) => byId.get(i.id)?.active).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Investments" actions={<PageHeaderAction label="Add SIP" onClick={() => setAdding(true)} />} />

      {maybe.length > 0 && (
        <Card className="animate-fade-in-up flex flex-col gap-3 border-brass/40 bg-brass-light p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles size={16} className="text-brass" aria-hidden="true" />
            {maybe.length === 1 ? 'Is this an investment?' : 'Are these investments?'}
          </p>
          {maybe.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-slate-700">
                {r.name} · {format(Number(r.amount))}
              </span>
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: r.id, is_investment: true }, { onSuccess: () => show(`${r.name} counts as an investment now.`) })}
              >
                Yes
              </Button>
            </div>
          ))}
        </Card>
      )}

      {empty ? (
        <EmptyState
          icon={TrendingUp}
          title="Track what you invest"
          description="Add your SIPs (or RD, PPF, NPS). Each time you tap Paid, it’s counted here, so you can see how much you put in and keep the habit going."
          action={<Button onClick={() => setAdding(true)}>Add a SIP</Button>}
        />
      ) : (
        <>
          <Card className="animate-fade-in-up flex flex-col gap-4 p-5">
            <div>
              <p className="text-helper font-semibold uppercase tracking-widest text-accent-dark">Put into investments</p>
              <p className="mt-1 font-serif text-4xl font-semibold tabular-nums text-slate-900">{format(total)}</p>
              {s.first && <p className="mt-0.5 text-helper text-slate-500">since {monthLabel(s.first.slice(0, 7), { month: 'short', year: 'numeric' })}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-app-border pt-3">
              <div>
                <p className="text-xs font-medium text-slate-500">This year</p>
                <p className="font-serif text-lg font-semibold tabular-nums text-slate-900">{format(s.thisYear)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">This month</p>
                <p className="font-serif text-lg font-semibold tabular-nums text-slate-900">
                  {format(s.thisMonth)}
                  {s.monthlyPlan > 0 && <span className="ml-1 font-sans text-xs font-medium text-slate-500">of {formatCompact(s.monthlyPlan)}</span>}
                </p>
              </div>
            </div>
          </Card>

          {/* The habit at a glance. */}
          <div className="stagger-rows grid grid-cols-3 gap-3">
            <Card className="flex flex-col gap-1 p-3">
              <TrendingUp size={16} className="text-accent-dark" aria-hidden="true" />
              <p className="font-serif text-lg font-semibold tabular-nums text-slate-900">{formatCompact(s.monthlyPlan)}</p>
              <p className="text-xs text-slate-500">a month · {activePlans === 1 ? '1 plan' : `${activePlans} plans`}</p>
            </Card>
            <Card className="flex flex-col gap-1 p-3">
              <Flame size={16} className={s.streak > 0 ? 'text-brass' : 'text-slate-400'} aria-hidden="true" />
              <p className="font-serif text-lg font-semibold tabular-nums text-slate-900">{s.streak}</p>
              <p className="text-xs text-slate-500">{s.streak === 1 ? 'month in a row' : 'months in a row'}</p>
            </Card>
            <Card className="flex flex-col gap-1 p-3">
              <Target size={16} className="text-positive" aria-hidden="true" />
              <p className="font-serif text-lg font-semibold tabular-nums text-slate-900">
                {s.incomeShare === null ? '' : s.incomeShare > 1 ? '100%+' : `${Math.round(s.incomeShare * 100)}%`}
              </p>
              <p className="text-xs text-slate-500">of money in, last 3 months</p>
            </Card>
          </div>

          <Card className="animate-fade-in-up flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Each month</h3>
              {s.monthlyPlan > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span className="w-4 border-t-2 border-dashed border-slate-400" aria-hidden="true" /> Your plan
                </span>
              )}
            </div>
            <div className="relative h-32">
              {s.monthlyPlan > 0 && (
                <div
                  className="absolute inset-x-0 border-t-2 border-dashed border-slate-300"
                  style={{ bottom: `${(s.monthlyPlan / chartMax) * 100}%` }}
                  aria-hidden="true"
                />
              )}
              <div className="absolute inset-0 flex items-end gap-1.5">
                {s.byMonth.map((m, i) => (
                  <div key={m.month} className="flex h-full min-w-0 flex-1 items-end justify-center" title={`${monthLabel(m.month, { month: 'long', year: 'numeric' })}: ${format(m.amount)}`}>
                    <div
                      className={clsx(
                        'animate-bar-rise w-full max-w-[22px] rounded-t-md',
                        m.amount === 0 ? 'bg-slate-200' : m.month === s.byMonth[11].month ? 'bg-accent' : 'bg-accent/45'
                      )}
                      style={{ height: m.amount > 0 ? `${Math.max(4, (m.amount / chartMax) * 100)}%` : '3px', animationDelay: `${i * 40}ms` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5">
              {s.byMonth.map((m, i) => (
                <span key={m.month} className={clsx('flex-1 text-center text-xs', i === 11 ? 'font-bold text-accent-dark' : 'text-slate-500')}>
                  {monthLabel(m.month, { month: 'narrow' })}
                </span>
              ))}
            </div>
          </Card>

          <Card className="animate-fade-in-up flex flex-col p-0">
            <h3 className="px-5 pb-2 pt-4 text-sm font-semibold text-slate-800">Your investments</h3>
            <ul className="divide-y divide-app-border">
              {s.items.map((i) => {
                const item = byId.get(i.id)
                const due = item?.active && i.next_date <= today
                const goal = goalName(i.goal_id)
                return (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                    <button type="button" onClick={() => item && setEditing(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-on-light">
                        <TrendingUp size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{i.name}</span>
                        <span className="block truncate text-helper text-slate-500">
                          {format(i.amount)} {CADENCE_WORDS[i.cadence]}
                          {item?.active ? ` · next ${formatShortDate(i.next_date)}` : ' · paused'}
                        </span>
                        {goal && <span className="block truncate text-helper text-accent-dark">Adds to {goal}</span>}
                      </span>
                    </button>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-serif text-base font-semibold tabular-nums text-slate-900">{format(i.putIn)}</span>
                      {due && item ? (
                        <Button variant="secondary" className="min-h-[32px] px-3 text-xs" disabled={markPaid.isPending} onClick={() => markPaid.mutate(item)}>
                          Paid
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">{i.payments === 1 ? '1 payment' : `${i.payments} payments`}</span>
                      )}
                    </span>
                  </li>
                )
              })}
              {s.oneOff > 0 && (
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">One-off investments</span>
                    <span className="block text-helper text-slate-500">Entries tagged #{INVEST_TAG}</span>
                  </span>
                  <span className="font-serif text-base font-semibold tabular-nums text-slate-900">{format(s.oneOff)}</span>
                </li>
              )}
            </ul>
          </Card>
        </>
      )}

      <Card className="flex flex-col gap-2 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Info size={16} className="text-accent-dark" aria-hidden="true" />
          How this works
        </h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate-600">
          <li>A SIP puts the same amount into a mutual fund on the same day every month. RD, PPF and NPS work the same way here.</li>
          <li>
            Add each one as a recurring payment and tick “This is an investment”. When the money goes out, tap <strong>Paid</strong>: it’s logged and counted here.
          </li>
          <li>
            Saving for something? Link the SIP to a <Link to="/goals" className="font-semibold text-accent-dark">goal</Link> and each payment adds to it.
          </li>
          <li>Bought something once (shares, gold)? Add it as an entry and tag it #{INVEST_TAG}.</li>
          <li>This shows what you put in, not what it’s worth today. Your fund app shows that.</li>
        </ul>
      </Card>

      <RecurringFormModal
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        kind="recurring"
        editing={editing}
        prefill={adding ? sipPrefill : null}
      />
    </div>
  )
}
