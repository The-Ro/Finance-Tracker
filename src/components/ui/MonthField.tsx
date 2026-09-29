import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const VIEWPORT_MARGIN = 16

interface MonthFieldProps {
  id?: string
  label?: string
  /** YYYY-MM, or '' for none. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const monthName = (index: number, style: 'short' | 'long') =>
  new Date(2000, index, 1).toLocaleDateString(undefined, { month: style })

/**
 * Month + year picker in the app's own style (same trigger and panel as
 * DateField): a year with arrows over a 3x4 grid of months. Replaces
 * <input type="month">, which iOS draws as its own wheel, unlike every other
 * picker here. Portaled with fixed positioning so a Modal's scroll box can't
 * clip it (same as DateField / Dropdown).
 */
export function MonthField({ id, label, value, onChange, placeholder = 'Choose month' }: MonthFieldProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [y, m] = value ? value.split('-').map(Number) : [NaN, NaN]
  const hasValue = Number.isFinite(y) && Number.isFinite(m)
  const [viewYear, setViewYear] = useState(() => (hasValue ? y : new Date().getFullYear()))
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const recalc = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    const t = trigger.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    let left = t.left
    if (left + p.width > window.innerWidth - VIEWPORT_MARGIN) left = t.right - p.width
    left = Math.max(VIEWPORT_MARGIN, left)
    let top = t.bottom + 4
    if (top + p.height > window.innerHeight - VIEWPORT_MARGIN) top = t.top - p.height - 4
    setPos({ top: Math.max(VIEWPORT_MARGIN, top), left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    if (hasValue) setViewYear(y)
    recalc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recalc])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, recalc])

  const now = new Date()
  const pick = (index: number) => {
    onChange(`${viewYear}-${String(index + 1).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-helper font-medium text-slate-600">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-app-border bg-white px-3 text-left text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          hasValue ? 'text-slate-900' : 'text-slate-400'
        )}
      >
        <span className="truncate">{hasValue ? `${monthName(m - 1, 'short')} ${y}` : placeholder}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-400" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose a month"
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
            className="animate-scale-in z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-app-border bg-white p-3 shadow-card"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous year"
                onClick={() => setViewYear((v) => v - 1)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-50 hover:text-accent-dark"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-800">{viewYear}</span>
              <button
                type="button"
                aria-label="Next year"
                onClick={() => setViewYear((v) => v + 1)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-50 hover:text-accent-dark"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const selected = hasValue && y === viewYear && m - 1 === i
                const current = now.getFullYear() === viewYear && now.getMonth() === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(i)}
                    aria-pressed={selected}
                    aria-label={`${monthName(i, 'long')} ${viewYear}`}
                    className={clsx(
                      'min-h-[40px] rounded-lg text-sm transition-colors',
                      selected
                        ? 'bg-accent font-semibold text-white'
                        : current
                          ? 'font-semibold text-accent-dark ring-1 ring-accent hover:bg-accent-light'
                          : 'text-slate-700 hover:bg-accent-light hover:text-accent-on-light'
                    )}
                  >
                    {monthName(i, 'short')}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
