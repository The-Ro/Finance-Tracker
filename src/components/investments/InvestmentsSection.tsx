import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useRecurringItemsRaw, useRecurringMutations } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { investmentSummary, looksLikeInvestment, monthYearLabel, INVEST_TAG } from '@/lib/investments'
import { todayISO } from '@/lib/format'

const CADENCE_WORDS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
  quarterly: 'every 3 months',
  'half-yearly': 'every 6 months',
  annual: 'every year',
}

/**
 * The investments half of "Goals & investments": how much went into SIPs,
 * RDs, PPF and the like (counted from each one's start month), the monthly
 * plan and streak, and each investment -- tap one for its detail page.
 * Money put in only, never what it's worth today.
 */
export function InvestmentsSection() {
  const { userId } = useAuth()
  const today = todayISO()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: recurring = [] } = useRecurringItemsRaw()
  const { update } = useRecurringMutations()
  const { format, formatCompact } = useFormatCurrency()
  const { show } = useToast()
  const [adding, setAdding] = useState(false)

  const s = useMemo(() => investmentSummary(transactions, recurring, today), [transactions, recurring, today])
  const total = useAnimatedNumber(s.total)
  const byId = useMemo(() => new Map(recurring.map((r) => [r.id, r])), [recurring])
  const maybe = recurring.filter((r) => r.kind === 'recurring' && !r.is_investment && looksLikeInvestment(r.name))
  const prefill = useMemo(() => ({ name: '', investment: true }), [])
  const hasAny = s.items.length > 0 || s.total > 0

  return (
    <section className="flex flex-col gap-3">
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

      {hasAny && (
        <div className="animate-fade-in-up flex flex-col gap-4 rounded-card bg-accent p-5 text-white shadow-card">
          <div>
            <p className="text-helper font-bold uppercase tracking-[0.12em] text-white/75">Put into investments</p>
            <p className="font-serif text-4xl font-semibold tabular-nums">{format(total)}</p>
            <p className="text-helper text-white/75">
              {s.first ? `since ${monthYearLabel(s.first)} · ` : ''}what you put in, not what it’s worth
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/75">Every month</p>
              <p className="font-semibold tabular-nums">{formatCompact(s.monthlyPlan)}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/75">In a row</p>
              <p className="font-semibold tabular-nums">{s.streak === 1 ? '1 month' : `${s.streak} months`}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Investments</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3.5 text-sm font-semibold text-accent-dark"
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Add SIP
        </button>
      </div>

      {hasAny ? (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-app-border">
            {s.items.map((i) => {
              const item = byId.get(i.id)
              const started = item?.started_on
              return (
                <li key={i.id}>
                  <Link to={`/investments/${i.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-slate-50">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-accent-on-light">
                      <TrendingUp size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-slate-900">{i.name}</span>
                      <span className="block truncate text-helper text-slate-500">
                        {formatCompact(i.amount)} {CADENCE_WORDS[i.cadence]}
                        {item && !item.active ? ' · paused' : ''}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {started ? `since ${monthYearLabel(started)}` : i.payments === 1 ? '1 payment' : `${i.payments} payments`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="font-serif text-base font-semibold tabular-nums text-slate-900">{format(i.putIn)}</span>
                      <span className="text-xs text-slate-500">put in</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
            {s.oneOff > 0 && (
              <li className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-900">One-off investments</span>
                  <span className="block text-helper text-slate-500">Entries tagged #{INVEST_TAG}</span>
                </span>
                <span className="font-serif text-base font-semibold tabular-nums text-slate-900">{format(s.oneOff)}</span>
              </li>
            )}
          </ul>
        </Card>
      ) : (
        <Card className="flex flex-col gap-1 p-4">
          <p className="text-sm font-semibold text-slate-900">Track your SIPs, RD, PPF</p>
          <p className="text-helper text-slate-500">
            Add one with the month it started. Every payment since then is counted, and each new one when you tap Paid.
          </p>
        </Card>
      )}

      <RecurringFormModal open={adding} onClose={() => setAdding(false)} kind="recurring" prefill={adding ? prefill : null} />
    </section>
  )
}
