import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useSendFeedback } from '@/hooks/useFeedback'
import { FormError } from '@/components/ui/FieldError'

export function FeedbackForm() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sendFeedback = useSendFeedback()
  const { show } = useToast()

  const handleSend = async () => {
    setError(null)
    try {
      await sendFeedback.mutateAsync(message)
      setMessage('')
      show("Thanks -- your feedback's been sent.")
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that. Try again.')
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-accent-dark" />
        <h3 className="text-sm font-semibold text-slate-800">Feedback</h3>
      </div>
      <p className="text-helper text-slate-500">Found a bug, or want something added? Tell us here.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's on your mind?"
        rows={4}
        maxLength={2000}
        className="min-h-[100px] w-full resize-y rounded-lg border border-app-border bg-white px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <FormError message={error} />
      <div>
        <Button onClick={handleSend} disabled={sendFeedback.isPending || !message.trim()}>
          {sendFeedback.isPending ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </Card>
  )
}
