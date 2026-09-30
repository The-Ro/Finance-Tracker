import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Plus, X } from 'lucide-react'
import { useCategories } from '@/hooks/useLookupLists'
import type { CategoryKind } from '@/types/database.types'

/**
 * "+ New" category right where one is picked (Add entry's chip row, the
 * recurring and budget forms): tap, type a name, and it's created for that
 * type and selected. Reuses an existing category (any case) instead of adding
 * a near-duplicate. `variant="chip"` sits in a chip row; `"link"` under a dropdown.
 */
export function QuickAddCategory({
  kind,
  onAdded,
  variant = 'chip',
}: {
  kind: CategoryKind
  onAdded: (name: string) => void
  variant?: 'chip' | 'link'
}) {
  const { data: all = [], add } = useCategories()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = async () => {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) return
    setError(null)
    const existing = all.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    try {
      if (!existing) await add.mutateAsync({ name: trimmed, kind })
      onAdded(existing ?? trimmed)
      setName('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that category.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
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

  return (
    <div className="flex w-full min-w-0 max-w-sm flex-col gap-1">
      <div className="flex w-full min-w-0 items-center gap-1 rounded-full border border-accent bg-white py-1 pl-3 pr-1">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }
          }}
          maxLength={40}
          placeholder="New category"
          aria-label="New category name"
          className="min-h-[34px] min-w-0 flex-1 bg-transparent text-helper focus:outline-none"
        />
        <button
          type="button"
          aria-label="Add category"
          onClick={() => void submit()}
          disabled={!name.trim() || add.isPending}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
        >
          <Check size={15} strokeWidth={2.6} />
        </button>
        <button
          type="button"
          aria-label="Cancel new category"
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X size={15} />
        </button>
      </div>
      {error && <span className="text-helper text-danger">{error}</span>}
    </div>
  )
}
