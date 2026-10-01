import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, MoreVertical, PlusSquare, Share, X } from 'lucide-react'
import { BrandMark } from '@/components/ui/BrandHeader'
import { useToast } from '@/context/ToastContext'
import { OPEN_INSTALL_EVENT, usePwaInstall } from '@/hooks/usePwaInstall'
import { shouldShowInstallCard } from '@/lib/installPrompt'

const SNOOZE_KEY = 'ledgeeaze:install-snoozed-at'
/** Wait a moment after opening before offering it, so it isn't the first thing in the way. */
const SHOW_AFTER_MS = 5000
/** Sign-in pages: the card waits until you're inside the app. */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password']

function readSnooze(): number | null {
  try {
    const v = Number(localStorage.getItem(SNOOZE_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}
function writeSnooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  } catch {
    // Private mode etc.: it just shows again next time.
  }
}

/**
 * "Add LedgeEaze to your home screen", on phones and tablets that haven't
 * installed it (logic in src/lib/installPrompt.ts). Android/Chrome: Install
 * opens the browser's own install dialog. iPhone/iPad: websites can't install
 * themselves, so it walks through Share -> Add to Home Screen, with an arrow
 * at the Share button. Also opened from the profile menu's "Install app".
 */
export function InstallPrompt() {
  const { isStandalone, device, isIos, iosBrowser, canPromptInstall, promptInstall } = usePwaInstall()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState(false)

  // Auto-show once per load, after a pause, when nothing else (a sheet, the
  // welcome wizard) is open.
  useEffect(() => {
    if (!shouldShowInstallCard({ standalone: isStandalone, device, snoozedAt: readSnooze(), now: Date.now() })) return
    let timer: number
    const tryShow = () => {
      // Not over the sign-in forms (it covered the password box), not while a
      // sheet is open, and not while someone is typing: wait and try again.
      const onAuthPage = AUTH_PATHS.some((p) => window.location.pathname.startsWith(p))
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
      if (onAuthPage || typing || document.querySelector('[role=dialog]')) {
        timer = window.setTimeout(tryShow, 3000)
        return
      }
      setOpen(true)
    }
    timer = window.setTimeout(tryShow, SHOW_AFTER_MS)
    return () => window.clearTimeout(timer)
    // Decided once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setSteps(isIos || !canPromptInstall)
    }
    window.addEventListener(OPEN_INSTALL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, onOpen)
  }, [isIos, canPromptInstall])

  useEffect(() => {
    if (isStandalone) setOpen(false)
  }, [isStandalone])

  if (!open || isStandalone) return null

  const close = () => {
    writeSnooze()
    setOpen(false)
    setSteps(false)
  }
  const install = async () => {
    if (canPromptInstall) {
      const accepted = await promptInstall()
      setOpen(false)
      if (accepted) show('Added. Open LedgeEaze from your home screen.', { tone: 'success' })
      else writeSnooze()
      return
    }
    setSteps(true)
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      show('Link copied. Paste it in Safari.', { tone: 'success' })
    } catch {
      show(window.location.origin, { tone: 'info' })
    }
  }

  const showArrow = steps && isIos && iosBrowser !== 'in-app'

  return (
    <>
      <div
        role="region"
        aria-label="Add LedgeEaze to your home screen"
        className={clsx(
          'animate-sheet-up fixed inset-x-3 z-[45] rounded-2xl border border-app-border bg-app-card p-4 shadow-card-lg',
          'bottom-[calc(4.75rem+var(--tab-pad-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]'
        )}
      >
        <div className="flex items-start gap-3">
          <BrandMark size="md" className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Add LedgeEaze to your home screen</p>
            <p className="mt-0.5 text-helper text-slate-500">It opens full screen like an app, and works offline.</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Not now"
            className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        {steps ? (
          <ol className="stagger-rows-soft mt-3 flex flex-col gap-2 text-sm text-slate-700">
            {isIos && iosBrowser === 'in-app' ? (
              <>
                <Step n={1}>
                  Open this page in <b>Safari</b> (tap <MoreVertical size={15} className="inline" aria-label="menu" /> or ••• and
                  choose Open in Safari).
                </Step>
                <Step n={2}>Then come back to this card there.</Step>
                <button
                  type="button"
                  onClick={copyLink}
                  className="press mt-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-app-border text-sm font-semibold text-slate-700"
                >
                  <Copy size={15} aria-hidden="true" /> Copy link
                </button>
              </>
            ) : isIos ? (
              <>
                <Step n={1}>
                  Tap <Share size={16} className="inline text-info" aria-label="Share" /> <b>Share</b>{' '}
                  {device === 'ipad' ? 'at the top right' : 'in the bar at the bottom'} (on newer iPhones it's under •••).
                </Step>
                <Step n={2}>
                  Scroll down and tap <PlusSquare size={16} className="inline" aria-hidden="true" /> <b>Add to Home Screen</b>.
                </Step>
                <Step n={3}>
                  Tap <b>Add</b>. LedgeEaze is now on your home screen.
                </Step>
                {showArrow && device === 'iphone' && (
                  <li aria-hidden="true" className="flex items-center justify-center gap-2 pt-1 text-helper font-medium text-accent-dark">
                    Safari's bar is just below
                    <ArrowDown size={18} className="motion-safe:animate-bounce" />
                  </li>
                )}
              </>
            ) : (
              <>
                <Step n={1}>
                  Tap <MoreVertical size={16} className="inline" aria-label="menu" /> <b>menu</b> at the top right of your browser.
                </Step>
                <Step n={2}>
                  Tap <b>Install app</b> or <b>Add to Home screen</b>.
                </Step>
              </>
            )}
          </ol>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="press inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white"
            >
              <Download size={16} aria-hidden="true" />
              {canPromptInstall ? 'Install' : 'Show me how'}
            </button>
            <button
              type="button"
              onClick={close}
              className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Not now
            </button>
          </div>
        )}
      </div>

      {/* iPad: points at Safari's Share button at the top right (the iPhone
          arrow is inside the card, pointing down at Safari's bar). */}
      {showArrow && device === 'ipad' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-24 top-3 z-[46] flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-card-lg motion-safe:animate-bounce"
        >
          <ArrowUp size={22} />
        </div>
      )}
    </>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent-on-light">
        {n}
      </span>
      <span className="min-w-0 pt-0.5 leading-snug">{children}</span>
    </li>
  )
}
