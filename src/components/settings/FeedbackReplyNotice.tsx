import { X } from 'lucide-react'
import { useMyFeedbackReplies, useMarkFeedbackReplySeen } from '@/hooks/useFeedback'

/** Shows up for anyone (not just the admin) whose feedback got a reply they
 *  haven't dismissed yet -- this is the notification the admin's reply
 *  actually lands as, read via the same feedback row rather than a
 *  separate notifications table. */
export function FeedbackReplyNotice() {
  const replies = useMyFeedbackReplies()
  const markSeen = useMarkFeedbackReplySeen()
  const items = replies.data ?? []

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-app-border p-3">
      <p className="text-sm font-semibold text-slate-800">Reply to your feedback</p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="border-t border-app-border pt-2 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-helper text-slate-500">You said: "{item.message}"</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => markSeen.mutate(item.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-1 rounded-lg bg-accent-light px-2.5 py-2 text-sm text-accent-on-light">{item.admin_reply}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
