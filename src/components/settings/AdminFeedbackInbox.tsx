import { useState } from 'react'
import { X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useProfiles } from '@/hooks/useProfiles'
import {
  useAdminFeedbackInbox,
  useSendFeedbackReply,
  useDismissFeedbackItem,
  type FeedbackRow,
} from '@/hooks/useFeedback'
import { formatShortDate } from '@/lib/format'

function ReplyComposer({ item }: { item: FeedbackRow }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const sendReply = useSendFeedbackReply()

  const handleSend = async () => {
    try {
      await sendReply.mutateAsync({ id: item.id, reply: draft })
      setDraft('')
      setOpen(false)
    } catch {
      // Error state isn't surfaced here beyond the button staying enabled --
      // this is a compact dropdown widget, not worth a full inline-error UI
      // for a single admin's own retry.
    }
  }

  if (item.admin_reply) {
    return (
      <div className="mt-2 rounded-lg bg-accent-light px-2.5 py-2">
        <p className="text-helper font-medium text-accent-on-light">Your reply</p>
        <p className="text-helper text-slate-600">{item.admin_reply}</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-helper font-medium text-accent hover:underline"
      >
        Reply
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        className="w-full rounded-lg border border-app-border bg-white px-2.5 py-1.5 text-helper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {/* Send kept as plain text like Cancel, not a filled button -- this is
          a compact two-word choice, not a primary call to action that needs
          to visually dominate the row. */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)} className="text-helper text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={sendReply.isPending || !draft.trim()}
          className="text-helper font-medium text-accent hover:underline disabled:opacity-50 disabled:hover:no-underline"
        >
          {sendReply.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

/** Admin-only (gated by the caller via useIsAdmin) --
 *  every user's feedback submission, newest first, with an inline reply
 *  composer. Lives in the notification bell dropdown alongside everyone
 *  else's own notifications. */
export function AdminFeedbackInbox() {
  const inbox = useAdminFeedbackInbox()
  const profiles = useProfiles()
  const dismiss = useDismissFeedbackItem()
  const items = inbox.data ?? []
  const profileMap = profiles.data ?? {}

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-app-border p-3">
      <p className="text-sm font-semibold text-slate-800">Feedback ({items.length})</p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const profile = profileMap[item.owner_user_id]
          return (
            <li key={item.id} className="border-t border-app-border pt-2 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2">
                <Avatar avatar={profile?.avatar ?? null} name={profile?.displayName || profile?.email || '?'} size={20} />
                <span className="truncate text-helper font-medium text-slate-700">
                  {profile?.displayName || profile?.email || 'Unknown user'}
                </span>
                <span className="ml-auto shrink-0 text-helper text-slate-400">
                  {formatShortDate(item.created_at.slice(0, 10))}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  title="Dismiss -- doesn't notify or affect the sender"
                  onClick={() => dismiss.mutate(item.id)}
                  disabled={dismiss.isPending}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-700">{item.message}</p>
              <ReplyComposer item={item} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
