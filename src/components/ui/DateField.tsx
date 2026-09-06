import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface DateFieldProps {
  id?: string
  label?: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseValue(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function toValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Native `<input type="date">` can't be fully themed -- Chromium renders the
 * focused day/month/year segment with the OS highlight color, which no CSS
 * property (including accent-color) can override. Same reasoning as
 * Dropdown.tsx: build it from plain elements instead.
 */
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 120 + 20 + 1 }, (_, i) => CURRENT_YEAR + 20 - i)

export function DateField({ id, label, value, onChange, placeholder = 'Select date', className }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const selected = parseValue(value)
  const [viewDate, setViewDate] = useState(() => selected ?? new Date())
  const containerRef = useRef<HTMLDivElement>(null)
  const yearListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (selected) setViewDate(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) {
      setMonthPickerOpen(false)
      setYearPickerOpen(false)
    }
  }, [open])

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
    if (yearPickerOpen) yearListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [yearPickerOpen])

  const days = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const startOffset = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = Array(startOffset).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    return cells
  }, [viewDate])

  const emit = (next: string) => onChange({ target: { value: next } } as unknown as ChangeEvent<HTMLInputElement>)
  const today = new Date()

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-helper font-medium text-slate-600">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={id}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={clsx(
            'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-app-border bg-white px-3 text-left text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            selected ? 'text-slate-900' : 'text-slate-400',
            className
          )}
        >
          <span className="truncate">
            {selected ? selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
          </span>
          <Calendar size={15} className="shrink-0 text-slate-400" />
        </button>

        {open && (
          <div className="animate-scale-in absolute left-0 z-30 mt-1 w-72 rounded-lg border border-app-border bg-white p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                className="shrink-0 rounded-full p-1.5 text-slate-500 hover:bg-slate-50 hover:text-accent-dark"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMonthPickerOpen((v) => !v)
                      setYearPickerOpen(false)
                    }}
                    className="rounded-md px-1.5 py-0.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {MONTH_NAMES[viewDate.getMonth()]}
                  </button>
                  {monthPickerOpen && (
                    <ul className="animate-scale-in absolute left-1/2 z-40 mt-1 max-h-48 w-32 -translate-x-1/2 overflow-y-auto rounded-lg border border-app-border bg-white py-1 shadow-card">
                      {MONTH_NAMES.map((m, i) => (
                        <li key={m}>
                          <button
                            type="button"
                            onClick={() => {
                              setViewDate(new Date(viewDate.getFullYear(), i, 1))
                              setMonthPickerOpen(false)
                            }}
                            className={clsx(
                              'block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-light hover:text-accent-dark',
                              i === viewDate.getMonth() ? 'bg-accent-light font-medium text-accent-dark' : 'text-slate-700'
                            )}
                          >
                            {m}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setYearPickerOpen((v) => !v)
                      setMonthPickerOpen(false)
                    }}
                    className="rounded-md px-1.5 py-0.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {viewDate.getFullYear()}
                  </button>
                  {yearPickerOpen && (
                    <ul
                      ref={yearListRef}
                      className="animate-scale-in absolute left-1/2 z-40 mt-1 max-h-48 w-24 -translate-x-1/2 overflow-y-auto rounded-lg border border-app-border bg-white py-1 shadow-card"
                    >
                      {YEARS.map((y) => (
                        <li key={y} data-selected={y === viewDate.getFullYear()}>
                          <button
                            type="button"
                            onClick={() => {
                              setViewDate(new Date(y, viewDate.getMonth(), 1))
                              setYearPickerOpen(false)
                            }}
                            className={clsx(
                              'block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-light hover:text-accent-dark',
                              y === viewDate.getFullYear() ? 'bg-accent-light font-medium text-accent-dark' : 'text-slate-700'
                            )}
                          >
                            {y}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                className="shrink-0 rounded-full p-1.5 text-slate-500 hover:bg-slate-50 hover:text-accent-dark"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-helper text-slate-400">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {days.map((date, i) => (
                <div key={i} className="flex items-center justify-center">
                  {date && (
                    <button
                      type="button"
                      onClick={() => {
                        emit(toValue(date))
                        setOpen(false)
                      }}
                      className={clsx(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                        selected && isSameDay(date, selected)
                          ? 'bg-accent font-semibold text-white'
                          : isSameDay(date, today)
                            ? 'border border-accent font-medium text-accent-dark'
                            : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {date.getDate()}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selected && (
              <button
                type="button"
                onClick={() => {
                  emit('')
                  setOpen(false)
                }}
                className="mt-2 w-full rounded-lg border border-app-border py-1.5 text-helper font-medium text-slate-500 hover:bg-slate-50"
              >
                Clear date
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
