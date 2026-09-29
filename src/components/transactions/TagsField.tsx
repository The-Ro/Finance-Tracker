import { useState } from 'react'
import clsx from 'clsx'
import { Plus, X } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { useDeleteTag, useTags } from '@/hooks/useLookupLists'

interface TagsFieldProps {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function TagsField({ selected, onChange }: TagsFieldProps) {
  const { data: allTags = [], add } = useTags()
  const deleteTag = useDeleteTag()
  const [newTag, setNewTag] = useState('')
  // "Edit" mode puts an x on each suggestion; tapping it asks inline (no
  // second sheet over the entry form) before deleting the tag everywhere.
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const toggle = (tag: string) => {
    if (selected.includes(tag)) onChange(selected.filter((t) => t !== tag))
    else onChange([...selected, tag])
  }

  const createTag = async () => {
    const trimmed = newTag.trim().toLowerCase()
    if (!trimmed) return
    if (!allTags.includes(trimmed)) await add.mutateAsync(trimmed)
    if (!selected.includes(trimmed)) onChange([...selected, trimmed])
    setNewTag('')
  }

  const suggestions = allTags.filter((t) => !selected.includes(t))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-helper font-medium text-slate-600">Tags</span>
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v)
              setConfirming(null)
            }}
            className="min-h-[32px] rounded-md px-2 text-helper font-semibold text-accent-dark hover:underline"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => (
          <Pill key={tag} label={tag} onRemove={() => toggle(tag)} />
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) =>
            confirming === tag ? (
              <span key={tag} className="animate-scale-in flex items-center gap-1 rounded-full bg-danger-light py-0.5 pl-2.5 pr-0.5 text-helper text-danger">
                Delete #{tag} from all entries?
                <button
                  type="button"
                  onClick={() => deleteTag.mutate(tag, { onSuccess: () => setConfirming(null) })}
                  disabled={deleteTag.isPending}
                  className="rounded-full bg-danger px-2 py-1 font-semibold text-white disabled:opacity-60"
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="rounded-full px-2 py-1 font-semibold">
                  Keep
                </button>
              </span>
            ) : (
              <span key={tag} className="flex items-center">
                <button
                  type="button"
                  onClick={() => (editing ? setConfirming(tag) : toggle(tag))}
                  className={clsx(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-helper',
                    editing
                      ? 'border-danger/40 text-slate-600 hover:bg-danger-light'
                      : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                  )}
                  aria-label={editing ? `Delete tag ${tag}` : `Add tag ${tag}`}
                >
                  #{tag}
                  {editing && <X size={12} className="text-danger" aria-hidden="true" />}
                </button>
              </span>
            )
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              createTag()
            }
          }}
          placeholder="New tag name"
          className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={createTag}
          aria-label="Add tag"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-app-border text-slate-600 hover:border-accent hover:text-accent-dark"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
