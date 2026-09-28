import { useState } from 'react'
import clsx from 'clsx'
import { CircleCheck, Info, Megaphone, X } from 'lucide-react'
import { isLiveAnnouncement, useAnnouncements } from '@/hooks/useAdmin'

const DISMISSED_KEY = 'ledgeeaze:dismissed-announcements'

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    // Only the most recent few matter; keep the list from growing forever.
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-30)))
  } catch {
    // Storage unavailable (private mode) -- it just reappears next load.
  }
}

const TONE = {
  info: { icon: Info, className: 'border-info/30 bg-info-light text-info' },
  success: { icon: CircleCheck, className: 'border-positive/30 bg-positive-light text-positive' },
  warning: { icon: Megaphone, className: 'border-caution/30 bg-caution-light text-caution' },
} as const

/**
 * The newest live admin announcement (Admin -> Announcements), above every
 * page. Closing it hides that announcement in this browser only (a per-viewer
 * convenience in localStorage); a new announcement shows again.
 */
export function AnnouncementBanner() {
  const { data = [] } = useAnnouncements()
  const [dismissed, setDismissed] = useState(readDismissed)
  const current = data.find((a) => isLiveAnnouncement(a) && !dismissed.includes(a.id))
  if (!current) return null
  const tone = TONE[current.tone] ?? TONE.info
  const Icon = tone.icon
  return (
    <div role="status" className={clsx('animate-fade-in-up flex items-start gap-2.5 rounded-xl border px-3.5 py-3', tone.className)}>
      <Icon size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">{current.message}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          const next = [...dismissed, current.id]
          setDismissed(next)
          writeDismissed(next)
        }}
        className="-my-1.5 -mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white/60 hover:text-slate-800"
      >
        <X size={16} />
      </button>
    </div>
  )
}
