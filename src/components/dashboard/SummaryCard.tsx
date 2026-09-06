import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

interface SummaryCardProps {
  label: string
  value: string
  valueClassName?: string
  footer: ReactNode
}

export function SummaryCard({ label, value, valueClassName, footer }: SummaryCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="text-helper font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={'text-2xl font-semibold text-slate-900 ' + (valueClassName ?? '')}>{value}</span>
      <div className="border-t border-app-border pt-2 text-helper text-slate-500">{footer}</div>
    </Card>
  )
}
