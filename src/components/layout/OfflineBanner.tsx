import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg bg-caution-light px-3 py-2 text-helper text-caution"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>
        You're offline, showing your last saved data. Changes you make will only save if this tab is still open
        when you're back online.
      </span>
    </div>
  )
}
