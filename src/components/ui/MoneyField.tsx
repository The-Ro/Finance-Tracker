import { forwardRef, type ComponentProps } from 'react'
import { TextField } from './TextField'
import { cleanAmountInput, groupAmountInput } from '@/lib/amountInput'

type MoneyFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'value' | 'onChange'> & {
  /** The plain number text, e.g. "62000" (never with commas). */
  value: string
  /** Called with the plain number text. */
  onChange: (value: string) => void
}

/**
 * An amount field that shows thousands commas as you type ("62,000") while
 * the form keeps the plain number ("62000"). Text input with the decimal
 * keypad, since a number input can't show commas.
 */
export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(({ value, onChange, ...props }, ref) => (
  <TextField
    ref={ref}
    {...props}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={groupAmountInput(value)}
    onChange={(e) => onChange(cleanAmountInput(e.target.value))}
  />
))
MoneyField.displayName = 'MoneyField'
