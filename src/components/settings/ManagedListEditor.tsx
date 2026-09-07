import { useState } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ManagedListEditorProps {
  title: string
  items: string[]
  onAdd: (name: string) => Promise<void>
  onRemove: (name: string) => Promise<void>
}

export function ManagedListEditor({ title, items, onAdd, onRemove }: ManagedListEditorProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

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

  const handleRemove = async (name: string) => {
    setError(null)
    setRemoving(name)
    try {
      await onRemove(name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-helper text-slate-600"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => handleRemove(item)}
              disabled={removing === item}
              className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
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
      {error && <p className="text-helper text-red-600">{error}</p>}
      <p className="text-helper text-slate-400">Personal to your account only - nobody else sees or shares this list.</p>
    </Card>
  )
}
