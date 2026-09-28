import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * With `registerType: 'prompt'` (vite.config.ts) a new build installs in the
 * background and waits; `onNeedRefresh` flips `needRefresh`, this banner
 * appears, and Refresh tells the waiting worker to take over, after which the
 * plugin reloads the tab. The interval below checks for a new build even
 * while a home-screen PWA just sits open for days.
 */
export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  // Belt-and-suspenders: if a new service worker ever takes control outside
  // this flow (e.g. a manual update elsewhere), reload once so the running
  // tab can't silently keep serving old JS against a newer worker.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  if (!needRefresh) return null

  return (
    // z-[55]: above an open Modal (z-50, e.g. the auto-shown What's new), below
    // dropdown/date popovers (z-[60]) so it never covers a list inside a modal.
    <div className="fixed inset-x-0 bottom-0 z-[55] flex items-center justify-center gap-3 border-t border-app-border bg-app-navy px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-white shadow-card">
      <p className="text-sm">A new version of LedgeEaze is available.</p>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium hover:bg-accent-dark"
      >
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  )
}
