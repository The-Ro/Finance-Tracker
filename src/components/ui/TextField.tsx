import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-helper font-medium text-slate-600">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'min-h-[44px] rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
TextField.displayName = 'TextField'
