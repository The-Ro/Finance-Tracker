import clsx from 'clsx'
import type { MonthTotals } from '@/lib/monthlyReview'

interface MonthCompareProps {
  current: MonthTotals
  prior: MonthTotals
  currentLabel: string
  priorLabel: string
  format: (n: number) => string
}

type Tone = 'good' | 'bad' | 'flat'

function toneClass(tone: Tone) {
  return tone === 'good' ? 'text-positive' : tone === 'bad' ? 'text-danger' : 'text-slate-500'
}

/** This month vs last month, side by side: spent, money in, and the share kept. */
export function MonthCompare({ current, prior, currentLabel, priorLabel, format }: MonthCompareProps) {
  const spentDelta = current.spent - prior.spent
  const incomeDelta = current.income - prior.income
  const keptDelta =
    current.keptPercent !== null && prior.keptPercent !== null ? Math.round(current.keptPercent) - Math.round(prior.keptPercent) : null
  const kept = (p: number | null) => (p === null ? '' : `${Math.round(p)}%`)

  const rows: { label: string; now: string; before: string; change: string | null; tone: Tone }[] = [
    {
      label: 'Spent',
      now: format(current.spent),
      before: format(prior.spent),
      change: spentDelta === 0 ? 'Same' : `${spentDelta > 0 ? '+' : '−'}${format(Math.abs(spentDelta))}`,
      // Spending less is the good direction.
      tone: spentDelta === 0 ? 'flat' : spentDelta < 0 ? 'good' : 'bad',
    },
    {
      label: 'Money in',
      now: format(current.income),
      before: format(prior.income),
      change: incomeDelta === 0 ? 'Same' : `${incomeDelta > 0 ? '+' : '−'}${format(Math.abs(incomeDelta))}`,
      tone: incomeDelta === 0 ? 'flat' : incomeDelta > 0 ? 'good' : 'bad',
    },
    {
      label: 'Kept',
      now: kept(current.keptPercent),
      before: kept(prior.keptPercent),
      change: keptDelta === null ? null : keptDelta === 0 ? 'Same' : `${keptDelta > 0 ? '+' : '−'}${Math.abs(keptDelta)} pts`,
      tone: keptDelta === null || keptDelta === 0 ? 'flat' : keptDelta > 0 ? 'good' : 'bad',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {rows.map((r) => (
        <div key={r.label} className="flex min-w-0 flex-col gap-1 rounded-xl bg-slate-50 p-3">
          <p className="text-helper text-slate-500">{r.label}</p>
          <p className="truncate font-serif text-lg font-semibold tabular-nums text-slate-900" title={`${currentLabel}: ${r.now}`}>
            {r.now}
          </p>
          <p className="truncate text-xs tabular-nums text-slate-500" title={`${priorLabel}: ${r.before}`}>
            {priorLabel}: {r.before}
          </p>
          {r.change && <p className={clsx('text-xs font-semibold tabular-nums', toneClass(r.tone))}>{r.change}</p>}
        </div>
      ))}
    </div>
  )
}
