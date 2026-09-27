import { useEffect, useId, useRef } from 'react'
import clsx from 'clsx'
import { CreditCard } from 'lucide-react'
import { useAccountKinds } from '@/hooks/useCards'

interface AccountChipsProps {
  label: string
  /** Already ordered (recent first) -- see orderAccountOptions in src/lib/entryForm.ts. */
  options: string[]
  value: string
  onChange: (account: string) => void
  /** Shown instead of the row when there's nothing to pick. */
  emptyText?: string
  className?: string
}

/**
 * One horizontally scrolling row of account chips, the same pattern as Add
 * entry's category row: one tap to pick, stays a single line tall. The
 * selected chip is kept in view with row.scrollTo (horizontal only --
 * scrollIntoView would also scroll the sheet vertically).
 */
export function AccountChips({ label, options, value, onChange, emptyText, className }: AccountChipsProps) {
  const labelId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const kinds = useAccountKinds()

  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [value, options.length])

  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <span id={labelId} className="text-helper font-medium text-slate-600">
        {label}
      </span>
      {options.length === 0 ? (
        <p className="text-helper text-slate-400">{emptyText ?? 'No accounts yet.'}</p>
      ) : (
        <div
          role="group"
          aria-labelledby={labelId}
          ref={rowRef}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {options.map((option) => {
            const selected = value === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option)}
                className={clsx(
                  'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-helper font-medium transition-colors active:scale-95',
                  selected
                    ? 'animate-pop-in border-accent bg-accent-light text-accent-on-light'
                    : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                )}
              >
                {kinds.get(option) === 'credit_card' && <CreditCard size={13} aria-label="Credit card" />}
                {option}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
