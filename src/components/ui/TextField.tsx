import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import { DateField } from './DateField'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, className, id, type, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const [visible, setVisible] = useState(false)
    const isPassword = type === 'password'

    if (type === 'date') {
      return (
        <DateField
          id={inputId}
          label={label}
          value={(props.value as string) ?? ''}
          onChange={props.onChange as (e: ChangeEvent<HTMLInputElement>) => void}
          placeholder={props.placeholder}
          className={className}
        />
      )
    }

    return (
      <div className="flex flex-col gap-1.5">
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
            className={clsx(
              'min-h-[44px] w-full rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </div>
    )
  }
)
TextField.displayName = 'TextField'
