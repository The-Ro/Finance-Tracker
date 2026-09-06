import { Dropdown } from './Dropdown'
import { PERIOD_OPTIONS } from '@/lib/period'
import type { SelectedPeriod } from '@/types/database.types'

interface PeriodSelectorProps {
  value: SelectedPeriod
  onChange: (value: SelectedPeriod) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const label = PERIOD_OPTIONS.find((opt) => opt.value === value)?.label ?? PERIOD_OPTIONS[0].label
  const labelToValue = new Map(PERIOD_OPTIONS.map((opt) => [opt.label, opt.value]))

  return (
    <Dropdown
      options={PERIOD_OPTIONS.map((opt) => opt.label)}
      value={label}
      aria-label="Date period"
      className="font-medium"
      onChange={(e) => {
        const period = labelToValue.get(e.target.value)
        if (period) onChange(period)
      }}
    />
  )
}
