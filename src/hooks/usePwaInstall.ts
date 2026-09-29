import { useSyncExternalStore } from 'react'
import { detectInstallDevice, detectIosBrowser } from '@/lib/installPrompt'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own (non-standard) flag for "launched from home screen".
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Module-level, so the event is caught even if it fires before any component
// using the hook has mounted (Chrome often fires it within the first second).
// main.tsx imports this module early for that reason.
let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = isStandaloneNow()
const listeners = new Set<() => void>()
let snapshot = { canPrompt: false, installed }
const emit = () => {
  snapshot = { canPrompt: !!deferredPrompt, installed }
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
}

/** Opens the install card from anywhere (the profile menu's "Install app"). */
export const OPEN_INSTALL_EVENT = 'ledgeeaze:open-install'
export function openInstallHelp() {
  window.dispatchEvent(new Event(OPEN_INSTALL_EVENT))
}

/**
 * The browser's install-prompt lifecycle. Chrome/Edge/Android fire
 * `beforeinstallprompt` when the app is installable; it's stashed and replayed
 * by promptInstall() (only once, and only from a tap). iOS Safari never fires
 * it and has no install API -- `device`/`iosBrowser` say which steps to show.
 */
export function usePwaInstall() {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
    () => snapshot
  )
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const device = detectInstallDevice(ua, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints)

  const promptInstall = async () => {
    const event = deferredPrompt
    if (!event) return false
    deferredPrompt = null
    emit()
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome === 'accepted'
  }

  return {
    isStandalone: state.installed,
    device,
    isIos: device === 'iphone' || device === 'ipad',
    iosBrowser: detectIosBrowser(ua),
    canPromptInstall: state.canPrompt,
    promptInstall,
  }
}
