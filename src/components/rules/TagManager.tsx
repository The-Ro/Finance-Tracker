import { useMemo, useState } from 'react'
import { Tags, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useDeleteTag, useTags } from '@/hooks/useLookupLists'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useMyTransactions } from '@/hooks/useTransactions'

export function TagManager() {
  const { userId } = useAuth()
  const { data: tags = [], add } = useTags()
  const deleteTag = useDeleteTag()
  const { show } = useToast()
  const myTransactions = useMyTransactions(userId)
  const [newTag, setNewTag] = useState('')
  const [pending, setPending] = useState<string | null>(null)

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

  const confirmDelete = () => {
    if (!pending) return
    const tag = pending
    deleteTag.mutate(tag, {
      onSuccess: () => {
        setPending(null)
        show(`Deleted #${tag}.`)
      },
      onError: () => show("Couldn't delete that tag. Try again.", { tone: 'error' }),
    })
  }

  const pendingCount = pending ? (usageCounts.get(pending) ?? 0) : 0

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
        <ul className="stagger-rows flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-helper text-slate-600">
              #{tag}
              <span className="rounded-full bg-white px-1.5 text-slate-500">{usageCounts.get(tag) ?? 0}</span>
              <button
                type="button"
                aria-label={`Delete tag ${tag}`}
                onClick={() => setPending(tag)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-danger-light hover:text-danger"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-helper text-slate-500">Deleting a tag removes it from every entry that has it.</p>

      <ConfirmDeleteModal
        open={pending !== null}
        title={`Delete #${pending ?? ''}?`}
        onCancel={() => setPending(null)}
        onConfirm={confirmDelete}
        pending={deleteTag.isPending}
      >
        {pendingCount > 0
          ? `It's on ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'}; it will be removed from them. The entries themselves stay.`
          : 'No entries use it.'}
      </ConfirmDeleteModal>
    </Card>
  )
}
