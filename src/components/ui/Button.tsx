import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark disabled:bg-accent/50',
  secondary: 'bg-white text-slate-700 border border-app-border hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(
        // `press` (index.css): 0.95 press on the motion spec's 120ms/200ms
        // timing, 0.98 when the button is w-full, nothing when disabled.
        'press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'
