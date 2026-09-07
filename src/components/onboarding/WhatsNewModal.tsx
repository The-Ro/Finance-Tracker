import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useUserSettings } from '@/hooks/useUserSettings'
import { CURRENT_WHATS_NEW_VERSION, WHATS_NEW_ITEMS } from '@/lib/whatsNew'

export function WhatsNewModal() {
  const settings = useUserSettings()

  const show =
    !settings.isLoading &&
    !!settings.data &&
    settings.data.onboardingCompleted &&
    settings.data.whatsNewSeenVersion !== CURRENT_WHATS_NEW_VERSION
  if (!show) return null

  const dismiss = () => settings.markWhatsNewSeen.mutate()

  return (
    <Modal open title="What's new in Ledgerly" onClose={dismiss}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2.5">
          {WHATS_NEW_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={dismiss} disabled={settings.markWhatsNewSeen.isPending}>
            {settings.markWhatsNewSeen.isPending ? 'Saving…' : 'Got it'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
