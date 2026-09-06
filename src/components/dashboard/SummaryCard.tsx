import type { ReactNode } from 'react'
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
}

export function SummaryCard({ label, value, numericValue, format, valueClassName, footer }: SummaryCardProps) {
  const animated = useAnimatedNumber(numericValue ?? 0)
  const displayValue = numericValue !== undefined && format ? format(animated) : value

  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="text-helper font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={'text-2xl font-semibold tabular-nums text-slate-900 ' + (valueClassName ?? '')}>
        {displayValue}
      </span>
      <div className="border-t border-app-border pt-2 text-helper text-slate-500">{footer}</div>
    </Card>
  )
}
