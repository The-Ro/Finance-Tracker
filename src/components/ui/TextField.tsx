import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import { DateField } from './DateField'
import { FieldError, useRevealOnError } from './FieldError'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Only meaningful for type="password" -- lets a caller slot the
   *  show/hide toggle into an explicit tab order alongside the input's own
   *  tabIndex, for forms where the natural DOM order isn't the desired tab
   *  order (e.g. a "Forgot password?" link visually beside the field but
   *  meant to be reached later in the sequence). */
  toggleTabIndex?: number
  /** Shown under the field, which turns red and scrolls into view (see useFieldErrors). */
  error?: string | null
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, className, id, type, toggleTabIndex, error, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const [visible, setVisible] = useState(false)
    const isPassword = type === 'password'
    const wrapRef = useRevealOnError<HTMLDivElement>(type === 'date' ? null : error, 'input')
    const errorId = error && inputId ? `${inputId}-error` : undefined

    if (type === 'date') {
      return (
        <DateField
          id={inputId}
          label={label}
          value={(props.value as string) ?? ''}
          onChange={props.onChange as (e: ChangeEvent<HTMLInputElement>) => void}
          placeholder={props.placeholder}
          className={className}
          error={error}
        />
      )
    }

    return (
      <div ref={wrapRef} className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-helper font-medium text-slate-600">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && visible ? 'text' : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={clsx(
              'min-h-[44px] w-full rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-1',
              error ? 'border-danger ring-1 ring-danger focus:border-danger focus:ring-danger' : 'border-app-border focus:border-accent focus:ring-accent',
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={toggleTabIndex}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        <FieldError id={errorId} message={error} />
      </div>
    )
  }
)
TextField.displayName = 'TextField'
