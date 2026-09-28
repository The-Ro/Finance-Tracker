import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

interface SummaryCardProps {
  label: string
  value: string
  /** When given alongside `format`, the displayed value counts up/down to it instead of snapping. */
  numericValue?: number
  format?: (n: number) => string
  valueClassName?: string
  footer: ReactNode
  /**
   * Marks this as the headline metric (net worth) -- gives it a subtle warm
   * accent tint (via the accent-light token) so it stands out from the other
   * summary cards, same as the "Total balance" card in the dashboard mockups.
   */
  highlight?: boolean
}

export function SummaryCard({ label, value, numericValue, format, valueClassName, footer, highlight }: SummaryCardProps) {
  const animated = useAnimatedNumber(numericValue ?? 0)
  const displayValue = numericValue !== undefined && format ? format(animated) : value

  return (
    <Card className={clsx('flex h-full flex-col gap-2 p-4 sm:gap-3 sm:p-5', highlight && 'border-accent/30 bg-accent-light')}>
      <span
        className={clsx(
          'pr-6 text-helper font-medium uppercase tracking-wide',
          highlight ? 'text-accent-on-light/80' : 'text-slate-500'
        )}
      >
        {label}
      </span>
      {/* Half-width tiles on phones: smaller figure, and a very large amount
          wraps rather than spilling out of the tile. */}
      <span
        className={clsx(
          'font-serif text-lg font-semibold tabular-nums text-slate-900 [overflow-wrap:anywhere] sm:text-2xl',
          valueClassName
        )}
      >
        {displayValue}
      </span>
      <div
        className={clsx(
          'mt-auto border-t pt-2 text-helper',
          highlight ? 'border-accent/20 text-accent-on-light/70' : 'border-app-border text-slate-500'
        )}
      >
        {footer}
      </div>
    </Card>
  )
}
