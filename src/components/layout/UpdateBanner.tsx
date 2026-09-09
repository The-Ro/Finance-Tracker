import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * The service worker's `registerType: 'autoUpdate'` (vite.config.ts) installs
 * a new version in the background, but an already-open tab -- especially a
 * PWA kept open on a home screen for hours or days -- never actually loads
 * that new code until something reloads it. Left alone, that shows up as
 * "the app doesn't refresh" after every deploy: the same stale bundle keeps
 * running no matter what the user does inside it.
 *
 * This does two things a bare `registerType: 'autoUpdate'` doesn't: checks
 * for a new version periodically even while the tab just sits open, and
 * surfaces a visible prompt (rather than swapping code out from under the
 * user mid-session) so they control when the reload happens.
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
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-app-border bg-app-navy px-4 py-3 text-white shadow-card">
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
