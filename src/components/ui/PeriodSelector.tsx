import { ListFilter } from 'lucide-react'
import { Dropdown } from './Dropdown'
import { PERIOD_OPTIONS } from '@/lib/period'
import type { SelectedPeriod } from '@/types/database.types'

interface PeriodSelectorProps {
  value: SelectedPeriod
  onChange: (value: SelectedPeriod) => void
  /** Filter-icon pill for toolbars (Home, Transactions) instead of a full-width field. */
  compact?: boolean
  /** Just the filter icon (Home) -- show the period somewhere else on the page. */
  iconOnly?: boolean
}

export function PeriodSelector({ value, onChange, compact, iconOnly }: PeriodSelectorProps) {
  const label = PERIOD_OPTIONS.find((opt) => opt.value === value)?.label ?? PERIOD_OPTIONS[0].label
  const labelToValue = new Map(PERIOD_OPTIONS.map((opt) => [opt.label, opt.value]))

  return (
    <Dropdown
      options={PERIOD_OPTIONS.map((opt) => opt.label)}
      value={label}
      aria-label="Date period"
      className="font-medium"
      compact={compact || iconOnly}
      iconOnly={iconOnly}
      icon={compact || iconOnly ? ListFilter : undefined}
      onChange={(e) => {
        const period = labelToValue.get(e.target.value)
        if (period) onChange(period)
      }}
    />
  )
}
