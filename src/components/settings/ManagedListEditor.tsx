import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check, Trash2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import {
  exitDelayMs,
  exitTotalMs,
  pruneSelected,
  selectedInOrder,
  summarizeRemoval,
  toggleSelected,
  type RemovalOutcome,
} from '@/lib/managedListSelection'
import '@/styles/managedList.css'

interface ManagedListEditorProps {
  title: string
  items: string[]
  onAdd: (name: string) => Promise<void>
  /** Leave out for an add-only list: no trash icons and no selection mode. */
  onRemove?: (name: string) => Promise<void>
  /** Categories: an icon at the start of each chip; tapping it calls onIconClick (e.g. to change it). */
  renderIcon?: (name: string) => ReactNode
  onIconClick?: (name: string) => void
  /** Something before the "Add new" field, e.g. the icon a new category will get. */
  addPrefix?: ReactNode
}

const EMPTY = new Set<string>()

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return 'Could not remove that.'
}

export function ManagedListEditor({ title, items, onAdd, onRemove, renderIcon, onIconClick, addPrefix }: ManagedListEditorProps) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(EMPTY)
  // Chips playing their exit animation, in the order they leave.
  const [leaving, setLeaving] = useState<string[]>([])
  // Chips that finished leaving while their delete is still in flight.
  const [hidden, setHidden] = useState<Set<string>>(EMPTY)
  // Chips whose delete failed; they pop back in.
  const [restored, setRestored] = useState<Set<string>>(EMPTY)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const canRemove = !!onRemove
  const visibleItems = items.filter((item) => !hidden.has(item))
  const chosen = selectedInOrder(selected, visibleItems)
  const allChosen = visibleItems.length > 0 && chosen.length === visibleItems.length

  const handleAdd = async () => {
    setError(null)
    const trimmed = value.trim()
    if (!trimmed) return
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setError('That already exists.')
      return
    }
    await onAdd(trimmed)
    setValue('')
  }

  const startSelecting = () => {
    setError(null)
    setRestored(EMPTY)
    setSelected(EMPTY)
    setSelecting(true)
  }

  const stopSelecting = () => {
    setSelecting(false)
    setSelected(EMPTY)
  }

  const toggle = (name: string) => {
    setRestored(EMPTY)
    setSelected((prev) => toggleSelected(pruneSelected(prev, items), name))
  }

  const toggleAll = () => {
    setRestored(EMPTY)
    setSelected(allChosen ? EMPTY : new Set(visibleItems))
  }

  // Chips animate out first, stay hidden while the deletes run, then either
  // disappear for good (the refetch drops them) or pop back with the reason.
  // `bulk` is the selection bar's Delete; a chip's own trash icon only
  // removes that chip and leaves the rest of the selection alone.
  const removeItems = async (names: string[], bulk: boolean) => {
    if (!onRemove || names.length === 0 || busy) return
    setError(null)
    setRestored(EMPTY)
    setBusy(true)
    setLeaving(names)
    const wait = prefersReducedMotion() ? 0 : exitTotalMs(names.length)
    await new Promise((resolve) => setTimeout(resolve, wait))
    if (!mounted.current) return
    setHidden(new Set(names))
    setLeaving([])

    const outcomes = await Promise.all(
      names.map(async (name): Promise<RemovalOutcome> => {
        try {
          await onRemove(name)
          return { name }
        } catch (e) {
          return { name, error: errorMessage(e) }
        }
      })
    )
    if (!mounted.current) return

    const summary = summarizeRemoval(outcomes, title)
    setHidden(EMPTY)
    setRestored(new Set(summary.failed))
    setError(summary.error)
    if (summary.toast) toast.show(summary.toast, { tone: 'success' })
    if (bulk) {
      // Everything went: leave selection mode. Otherwise keep the ones that
      // couldn't be deleted selected, next to their reason.
      if (summary.failed.length === 0) stopSelecting()
      else setSelected(new Set(summary.failed))
    } else {
      const gone = new Set(summary.removed)
      setSelected((prev) => new Set([...prev].filter((name) => !gone.has(name))))
    }
    setBusy(false)
  }

  return (
    <Card
      className="flex flex-col gap-3 p-5"
      onKeyDown={(e) => {
        if (selecting && e.key === 'Escape' && !busy) {
          e.stopPropagation()
          stopSelecting()
        }
      }}
    >
      <div className="flex min-h-[28px] items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {canRemove && !selecting && visibleItems.length > 0 && (
          <button
            type="button"
            onClick={startSelecting}
            disabled={busy}
            className="-my-2 -mr-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-helper font-semibold text-accent-dark hover:bg-slate-50 disabled:opacity-50"
          >
            Select
          </button>
        )}
      </div>

      {selecting && (
        <div className="ml-bar-in flex items-center gap-1 rounded-xl bg-slate-50 py-0.5 pl-3 pr-1">
          <span aria-live="polite" className="flex-1 text-sm font-medium tabular-nums text-slate-700">
            {chosen.length} selected
          </span>
          <button
            type="button"
            onClick={toggleAll}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-helper font-semibold text-accent-dark hover:bg-slate-100 disabled:opacity-50"
          >
            {allChosen ? 'Clear' : 'All'}
          </button>
          <button
            type="button"
            onClick={stopSelecting}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-helper font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label={`Delete ${chosen.length}`}
            title={`Delete ${chosen.length}`}
            onClick={() => removeItems(chosen, true)}
            disabled={busy || chosen.length === 0}
            className="ml-trash ml-chip-trash relative flex h-10 w-10 items-center justify-center rounded-full bg-danger-light text-danger before:absolute before:-inset-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {visibleItems.length > 0 && (
        <ul aria-label={title} className="flex flex-wrap gap-2">
          {visibleItems.map((item) => {
            const leaveIndex = leaving.indexOf(item)
            const isLeaving = leaveIndex !== -1
            const isSelected = selecting && selected.has(item)
            return (
              <li
                key={item}
                style={isLeaving ? { animationDelay: `${exitDelayMs(leaveIndex)}ms` } : undefined}
                className={clsx(
                  'ml-chip flex min-h-[36px] items-center rounded-full text-helper',
                  selecting && 'ml-chip-selecting',
                  isSelected ? 'bg-accent-light text-accent-on-light' : 'bg-slate-100 text-slate-600',
                  isLeaving && 'ml-chip-exit',
                  !isLeaving && restored.has(item) && 'animate-pop-in'
                )}
              >
                {selecting ? (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(item)}
                    disabled={busy}
                    className="relative flex min-h-[36px] items-center gap-1.5 rounded-full py-1.5 pl-2 pr-1 font-medium before:absolute before:-inset-y-1 before:inset-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      aria-hidden
                      className={clsx(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                        isSelected ? 'bg-accent text-white' : 'border-[1.5px] border-current text-slate-400'
                      )}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} className="ml-check-pop" />}
                    </span>
                    {item}
                  </button>
                ) : (
                  <>
                    {renderIcon && (
                      <button
                        type="button"
                        aria-label={`Change icon for ${item}`}
                        title="Change icon"
                        onClick={() => onIconClick?.(item)}
                        className="-mr-1.5 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-accent-dark"
                      >
                        {renderIcon(item)}
                      </button>
                    )}
                    <span className={clsx('ml-chip-label py-1.5', renderIcon ? 'pl-2' : 'pl-3', canRemove ? 'pr-1' : 'pr-3')}>{item}</span>
                  </>
                )}
                {canRemove && (
                  <button
                    type="button"
                    aria-label={`Delete ${item}`}
                    title={`Delete ${item}`}
                    onClick={() => removeItems([item], false)}
                    disabled={busy}
                    className={clsx(
                      'ml-trash ml-chip-trash relative mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full before:absolute before:-inset-x-1 before:-inset-y-2 hover:bg-danger-light hover:text-danger disabled:opacity-50',
                      isSelected ? 'text-accent-on-light' : 'text-slate-400'
                    )}
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex gap-2">
        {addPrefix}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add new"
          className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button variant="secondary" onClick={handleAdd}>
          Add
        </Button>
      </div>
      {error && <p className="text-helper text-danger">{error}</p>}
      <p className="text-helper text-slate-400">Personal to your account only - nobody else sees or shares this list.</p>
    </Card>
  )
}
