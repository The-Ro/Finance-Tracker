import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ManagedListEditorProps {
  title: string
  items: string[]
  onAdd: (name: string) => Promise<void>
}

export function ManagedListEditor({ title, items, onAdd }: ManagedListEditorProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-helper text-slate-600">
            {item}
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
      <p className="text-helper text-slate-400">
        Personal to your account only - nobody else sees or shares this list. Removing an item keeps its
        label on past transactions but hides it from future pickers - coming in a later version.
      </p>
    </Card>
  )
}
