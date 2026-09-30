import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Plus, X } from 'lucide-react'
import { useCategories } from '@/hooks/useLookupLists'
import { CategoryIconByKey } from '@/components/ui/CategoryIcon'
import { CATEGORY_ICON_CHOICES, categoryIconKey, type CategoryIconKey } from '@/lib/categoryIcon'
import type { CategoryKind } from '@/types/database.types'

/**
 * "+ New" category right where one is picked (Add entry's chip row, the
 * recurring and budget forms): tap, type a name, and it's created for that
 * type and selected. Reuses an existing category (any case) instead of adding
 * a near-duplicate.
 *
 * `variant="link"` sits under a dropdown and opens the editor in its place.
 * `variant="chip"` sits at the end of a scrolling chip row: pass `onOpen` and
 * render <NewCategoryEditor> below the row yourself -- inside the row the box
 * was cut off and its Add / Cancel buttons were off screen (iPhone).
 */
export function QuickAddCategory({
  kind,
  onAdded,
  variant = 'chip',
  onOpen,
}: {
  kind: CategoryKind
  onAdded: (name: string) => void
  variant?: 'chip' | 'link'
  /** Chip variant: open the editor somewhere else instead of inline. */
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)

  if (open && !onOpen) {
    return (
      <NewCategoryEditor
        kind={kind}
        onAdded={(name) => {
          setOpen(false)
          onAdded(name)
        }}
        onCancel={() => setOpen(false)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen() : setOpen(true))}
      className={clsx(
        'flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-accent-dark',
        variant === 'chip'
          ? 'min-h-[44px] rounded-full border border-dashed border-accent px-3 text-helper'
          : 'min-h-[32px] w-fit text-helper hover:underline'
      )}
    >
      <Plus size={14} aria-hidden="true" /> New{variant === 'link' ? ' category' : ''}
    </button>
  )
}

/**
 * The full-width "New category" box: a name field with a tick (add) and a
 * cross (cancel) inside it. Focuses itself and, once the keyboard is up, scrolls to the middle of
 * the sheet so the field and both buttons are in view.
 */
export function NewCategoryEditor({
  kind,
  onAdded,
  onCancel,
}: {
  kind: CategoryKind
  onAdded: (name: string) => void
  onCancel: () => void
}) {
  const { data: all = [], add } = useCategories()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The icon: guessed from the name as you type until you pick one yourself.
  const [pickedIcon, setPickedIcon] = useState<CategoryIconKey | null>(null)
  const icon = pickedIcon ?? categoryIconKey(name, kind)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    // The iPhone keyboard takes a moment to come up and shrink the view.
    const center = () => boxRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    center()
    const t = setTimeout(center, 350)
    return () => clearTimeout(t)
  }, [])

  const submit = async () => {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) {
      setError('Type a name for the category.')
      inputRef.current?.focus()
      return
    }
    setError(null)
    const existing = all.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    try {
      if (!existing) await add.mutateAsync({ name: trimmed, kind, icon })
      onAdded(existing ?? trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that category.')
    }
  }

  return (
    <div ref={boxRef} className="animate-fade-in-up flex w-full min-w-0 flex-col gap-1.5">
      <label htmlFor="new-category-name" className="text-helper font-medium text-slate-600">
        New {kind === 'income' ? 'income' : 'spending'} category
      </label>
      {/* The tick and cross sit inside the box, which is full width so both stay on screen. */}
      <div
        className={clsx(
          'flex w-full min-w-0 items-center gap-2 rounded-xl border bg-white py-1 pl-1.5 pr-1',
          error ? 'border-danger ring-1 ring-danger' : 'border-accent ring-1 ring-accent'
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-on-light" aria-hidden="true">
          <CategoryIconByKey key={icon} iconKey={icon} size={18} className="animate-pop-in" />
        </span>
        <input
          ref={inputRef}
          id="new-category-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            }
          }}
          maxLength={40}
          placeholder="e.g. Pets"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          className="min-h-[40px] min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button
          type="button"
          aria-label="Add category"
          onClick={() => void submit()}
          disabled={add.isPending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
        >
          <Check size={18} strokeWidth={2.6} />
        </button>
        <button
          type="button"
          aria-label="Cancel new category"
          onClick={onCancel}
          disabled={add.isPending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>
      {error && <span className="text-helper font-medium text-danger">{error}</span>}
      <div
        role="radiogroup"
        aria-label="Icon"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {CATEGORY_ICON_CHOICES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={icon === key}
            aria-label={label}
            title={label}
            onClick={() => setPickedIcon(key)}
            className={clsx(
              'press flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
              icon === key ? 'border-accent bg-accent-light text-accent-on-light' : 'border-app-border text-slate-500 hover:border-accent'
            )}
          >
            <CategoryIconByKey iconKey={key} size={17} />
          </button>
        ))}
      </div>
    </div>
  )
}
