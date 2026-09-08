import { useState } from 'react'
import { Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WhatsNewModal } from '@/components/onboarding/WhatsNewModal'
import { APP_VERSION } from '@/lib/whatsNew'

export function AboutSection() {
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-slate-800">About</h3>
      </div>
      <p className="text-helper text-slate-500">LedgeEaze v{APP_VERSION}</p>
      <div>
        <Button variant="secondary" onClick={() => setWhatsNewOpen(true)}>
          What's new
        </Button>
      </div>
      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </Card>
  )
}
