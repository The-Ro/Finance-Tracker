import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface DropdownProps {
  options: string[]
  value: string
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  className?: string
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Custom-styled listbox standing in for a native <select>. Browsers render a
 * native select's option-hover highlight using the OS accent color, which
 * CSS cannot override in most browsers (Chrome/Edge on Windows included) --
 * so a fully themed dropdown needs to be built from plain elements instead.
 * Keeps the old (e) => e.target.value call signature via a synthetic event
 * so every existing call site works unchanged.
 */
export function Dropdown({ options, value, onChange, className, disabled, ...rest }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  const selectValue = (opt: string) => {
    onChange({ target: { value: opt } } as unknown as ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        className={clsx(
          'flex min-h-[44px] w-full min-w-[9rem] items-center justify-between gap-2 rounded-lg border border-app-border bg-white px-3 text-left text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={15} className={clsx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="animate-scale-in absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-app-border bg-white py-1 shadow-card"
        >
          {options.map((opt) => (
            <li key={opt} role="option" aria-selected={opt === value} data-selected={opt === value}>
              <button
                type="button"
                onClick={() => selectValue(opt)}
                className={clsx(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent-light hover:text-accent-dark sm:py-2',
                  opt === value ? 'bg-accent-light font-medium text-accent-dark' : 'text-slate-700'
                )}
              >
                <span className="truncate">{opt}</span>
                {opt === value && <Check size={14} className="shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
