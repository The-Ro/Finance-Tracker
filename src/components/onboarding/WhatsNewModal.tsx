import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useUserSettings } from '@/hooks/useUserSettings'
import { CURRENT_WHATS_NEW_VERSION, WHATS_NEW_ITEMS } from '@/lib/whatsNew'

interface WhatsNewModalProps {
  /** Omit both props for the automatic once-after-login behavior (default
   *  export usage in AppShell). Pass both to open it on demand instead, e.g.
   *  Settings' "View what's new" button -- viewing it again doesn't touch
   *  `whatsNewSeenVersion`, since by definition it's already been seen. */
  open?: boolean
  onClose?: () => void
}

export function WhatsNewModal({ open: openProp, onClose: onCloseProp }: WhatsNewModalProps = {}) {
  const settings = useUserSettings()
  const isControlled = openProp !== undefined

  const autoShow =
    !settings.isLoading &&
    !!settings.data &&
    settings.data.onboardingCompleted &&
    settings.data.whatsNewSeenVersion !== CURRENT_WHATS_NEW_VERSION

  const show = isControlled ? openProp : autoShow
  if (!show) return null

  const dismiss = () => {
    if (isControlled) {
      onCloseProp?.()
    } else {
      settings.markWhatsNewSeen.mutate()
    }
  }

  return (
    <Modal open title="What's new in LedgeEaze" onClose={dismiss}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2.5">
          {WHATS_NEW_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-accent-dark" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={dismiss} disabled={!isControlled && settings.markWhatsNewSeen.isPending}>
            {!isControlled && settings.markWhatsNewSeen.isPending ? 'Saving…' : 'Got it'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
