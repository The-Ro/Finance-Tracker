import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TagsField } from './TagsField'
import { useUpdateTransactionTags } from '@/hooks/useTransactions'

interface InlineTagEditorProps {
  transactionId: string
  tags: string[]
  editable: boolean
}

export function InlineTagEditor({ transactionId, tags, editable }: InlineTagEditorProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [draftTags, setDraftTags] = useState<string[]>(tags)
  const update = useUpdateTransactionTags()

  const removeTag = (tag: string) => {
    update.mutate({ id: transactionId, tags: tags.filter((t) => t !== tag) })
  }

  const openModal = () => {
    setDraftTags(tags)
    setModalOpen(true)
  }

  const save = async () => {
    await update.mutateAsync({ id: transactionId, tags: draftTags })
    setModalOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Pill key={tag} label={tag} onRemove={editable ? () => removeTag(tag) : undefined} />
      ))}
      {editable && (
        <button
          type="button"
          aria-label="Add tag"
          onClick={openModal}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-app-border text-slate-500 hover:border-accent hover:text-accent-dark"
        >
          <Plus size={12} />
        </button>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Edit tags"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save tags'}
            </Button>
          </div>
        }
      >
        <TagsField selected={draftTags} onChange={setDraftTags} />
      </Modal>
    </div>
  )
}
