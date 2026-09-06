import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { useTags } from '@/hooks/useLookupLists'

interface TagsFieldProps {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function TagsField({ selected, onChange }: TagsFieldProps) {
  const { data: allTags = [], add } = useTags()
  const [newTag, setNewTag] = useState('')

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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-helper font-medium text-slate-600">Tags</span>
      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => (
          <Pill key={tag} label={tag} onRemove={() => toggle(tag)} />
        ))}
      </div>
      {allTags.filter((t) => !selected.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags
            .filter((t) => !selected.includes(t))
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="rounded-full border border-app-border px-2.5 py-1 text-helper text-slate-600 hover:border-accent hover:text-accent-dark"
              >
                {tag}
              </button>
            ))}
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
