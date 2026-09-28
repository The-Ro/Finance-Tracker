import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

export interface ChipOption {
  /** Unique across all groups, e.g. `account:HDFC Bank` or `debit:<card id>`. */
  key: string
  label: string
  icon: ReactNode
}

export interface ChipGroup {
  id: string
  label: string
  options: ChipOption[]
  /** Tucked behind a "+N more" chip at the end of the row (e.g. banks seeded at signup that were never used). */
  more?: ChipOption[]
}

interface AccountChipsProps {
  label: string
  groups: ChipGroup[]
  /** Key of the selected option. */
  value: string
  onChange: (key: string) => void
  /** Shown instead of the rows when no group has anything to pick. */
  emptyText?: string
  className?: string
}

/**
 * Account picker for Add entry: one labelled row per kind of thing you can pay
 * with (accounts, debit cards, credit cards), kept separate on purpose. Each
 * row scrolls sideways and keeps its selected chip in view with row.scrollTo
 * (horizontal only -- scrollIntoView would also scroll the sheet vertically).
 */
export function AccountChips({ label, groups, value, onChange, emptyText, className }: AccountChipsProps) {
  const labelId = useId()
  const visible = groups.filter((g) => g.options.length > 0 || (g.more?.length ?? 0) > 0)

  return (
    <div role="group" aria-labelledby={labelId} className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <span id={labelId} className="text-helper font-medium text-slate-600">
        {label}
      </span>
      {visible.length === 0 ? (
        <p className="text-helper text-slate-400">{emptyText ?? 'No accounts yet.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((group) => (
            <ChipRow key={group.id} group={group} value={value} onChange={onChange} showCaption={visible.length > 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChipRow({
  group,
  value,
  onChange,
  showCaption,
}: {
  group: ChipGroup
  value: string
  onChange: (key: string) => void
  showCaption: boolean
}) {
  const captionId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const hidden = group.more ?? []
  const options = expanded ? [...group.options, ...hidden] : group.options

  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [value, options.length])

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {showCaption && (
        <span id={captionId} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {group.label}
        </span>
      )}
      <div
        role="group"
        aria-label={showCaption ? undefined : group.label}
        aria-labelledby={showCaption ? captionId : undefined}
        ref={rowRef}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {options.map((option) => {
          const selected = value === option.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.key)}
              className={clsx(
                'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-helper font-medium transition-colors active:scale-95',
                selected
                  ? 'animate-pop-in border-accent bg-accent-light text-accent-on-light'
                  : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          )
        })}
        {!expanded && hidden.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-app-border px-3 text-helper font-medium text-slate-500 transition-colors hover:border-accent hover:text-accent-dark"
          >
            +{hidden.length} more
          </button>
        )}
      </div>
    </div>
  )
}
