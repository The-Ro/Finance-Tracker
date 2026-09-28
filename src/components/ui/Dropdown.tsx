import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface DropdownProps {
  options: string[]
  value: string
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  className?: string
  disabled?: boolean
  /** Pinned above the rest under a "Recent" label, most-recent first. Any entry not present in `options` is ignored. */
  recentOptions?: string[]
  'aria-label'?: string
}

const VIEWPORT_MARGIN = 16

/**
 * Custom-styled listbox standing in for a native <select>. Browsers render a
 * native select's option-hover highlight using the OS accent color, which
 * CSS cannot override in most browsers (Chrome/Edge on Windows included) --
 * so a fully themed dropdown needs to be built from plain elements instead.
 * Keeps the old (e) => e.target.value call signature via a synthetic event
 * so every existing call site works unchanged.
 *
 * The option list is portaled to <body> and positioned with `fixed`
 * coordinates in viewport space -- same reasoning as DateField's calendar
 * panel: a plain `absolute` list gets visually clipped when this dropdown
 * sits inside Modal's `overflow-y-auto` body, cutting the option list off
 * after however many rows fit instead of floating above the modal.
 */
export function Dropdown({ options, value, onChange, className, disabled, recentOptions, ...rest }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const recalcPosition = useCallback(() => {
    const trigger = triggerRef.current
    const list = listRef.current
    if (!trigger || !list) return
    const triggerRect = trigger.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()

    let top = triggerRect.bottom + 4
    if (top + listRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = triggerRect.top - listRect.height - 4
    }
    top = Math.max(VIEWPORT_MARGIN, top)

    let left = triggerRect.left
    if (left + triggerRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - VIEWPORT_MARGIN - triggerRect.width
    }
    left = Math.max(VIEWPORT_MARGIN, left)

    setPos({ top, left, width: triggerRect.width })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    recalcPosition()
  }, [open, recalcPosition])

  // The list is fixed-positioned in viewport space, so it doesn't move with
  // its trigger automatically when an ancestor scrolls (e.g. a modal's
  // scrollable body) or the viewport is resized -- keep it glued.
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', recalcPosition)
    window.addEventListener('scroll', recalcPosition, true)
    return () => {
      window.removeEventListener('resize', recalcPosition)
      window.removeEventListener('scroll', recalcPosition, true)
    }
  }, [open, recalcPosition])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      // List is portaled to <body>, so it's no longer a DOM descendant of
      // containerRef -- it needs its own "is this click inside" check.
      if (containerRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    // Capture phase runs before a parent Modal's bubble-phase listener.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  const selectValue = (opt: string) => {
    onChange({ target: { value: opt } } as unknown as ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  const recent = (recentOptions ?? []).filter((opt) => options.includes(opt))
  const restOptions = recent.length > 0 ? options.filter((opt) => !recent.includes(opt)) : options

  const renderOption = (opt: string) => (
    <li key={opt} role="option" aria-selected={opt === value} data-selected={opt === value}>
      <button
        type="button"
        onClick={() => selectValue(opt)}
        className={clsx(
          'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent-light hover:text-accent-on-light sm:py-2',
          opt === value ? 'bg-accent-light font-medium text-accent-on-light' : 'text-slate-700'
        )}
      >
        <span className="truncate">{opt}</span>
        {opt === value && <Check size={14} className="shrink-0" />}
      </button>
    </li>
  )

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        ref={triggerRef}
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
      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="animate-scale-in z-[60] max-h-64 overflow-auto rounded-lg border border-app-border bg-white py-1 shadow-card"
          >
            {recent.length > 0 && (
              <>
                <li className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent</li>
                {recent.map(renderOption)}
                <li role="presentation" className="my-1 border-t border-app-border" />
              </>
            )}
            {restOptions.map(renderOption)}
          </ul>,
          document.body
        )}
    </div>
  )
}
