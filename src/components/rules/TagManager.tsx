import { useMemo, useState } from 'react'
import { Tags } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTags } from '@/hooks/useLookupLists'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions } from '@/hooks/useTransactions'

export function TagManager() {
  const { userId } = useAuth()
  const { data: tags = [], add } = useTags()
  const myTransactions = useMyTransactions(userId)
  const [newTag, setNewTag] = useState('')

  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of myTransactions.data ?? []) {
      for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return counts
  }, [myTransactions.data])

  const handleCreate = async () => {
    const trimmed = newTag.trim().toLowerCase()
    if (!trimmed) return
    await add.mutateAsync(trimmed)
    setNewTag('')
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Tags size={16} className="text-accent-dark" />
        <h3 className="text-sm font-semibold text-slate-800">Tags</h3>
      </div>

      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New tag name"
          className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button variant="secondary" onClick={handleCreate}>
          Create tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <p className="text-helper text-slate-500">No tags yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-helper text-slate-600">
              {tag}
              <span className="rounded-full bg-white px-1.5 text-slate-400">{usageCounts.get(tag) ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-helper text-slate-400">
        Tags are personal to your account, so they can only be added, not removed, for now.
      </p>
    </Card>
  )
}
