import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { RecurringCandidate } from '@/lib/recurringDetection'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'
import clsx from 'clsx'

interface SuggestionCardProps {
  candidate: RecurringCandidate
  onKeep: () => void
  onIgnore: () => void
  busy?: boolean
}

export function SuggestionCard({ candidate, onKeep, onIgnore, busy }: SuggestionCardProps) {
  const { format } = useFormatCurrency()
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{candidate.merchant}</p>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              candidate.confidence === 'high' ? 'bg-positive-light text-positive' : 'bg-caution-light text-caution'
            )}
          >
            {candidate.confidence === 'high' ? 'High confidence' : 'Likely'}
          </span>
        </div>
        <p className="text-helper text-slate-500">
          {candidate.category} · {candidate.cadence} · {candidate.occurrenceCount} occurrences · avg{' '}
          {format(candidate.averageAmount)} · next {formatShortDate(candidate.nextDate)} · ~
          {format(candidate.monthlyEquivalent)}/mo
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onIgnore} disabled={busy}>
          Ignore
        </Button>
        <Button onClick={onKeep} disabled={busy}>
          Keep
        </Button>
      </div>
    </Card>
  )
}
