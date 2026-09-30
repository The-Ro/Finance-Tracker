import { useEffect, useState } from 'react'
import { BellRing, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useToast } from '@/context/ToastContext'
import { openInstallHelp } from '@/hooks/usePwaInstall'
import { catchUpReminders, currentPushState, sendTestReminder, turnOffReminders, turnOnReminders, type PushState } from '@/lib/push'

/**
 * Phone reminders on this device: one short note at 9 AM on days with bills
 * due or overdue, a card bill coming up, salary day, or money due back.
 */
export function ReminderSettings() {
  const { show } = useToast()
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    currentPushState().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light">
          <BellRing size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Phone reminders</h3>
          <p className="mt-1 text-helper text-slate-500">
            A short note at 9 AM on days when a bill is due or late, a card bill is coming up, your salary should
            arrive, or someone should pay you back. Nothing on quiet days.
          </p>
        </div>
      </div>

      {state === 'loading' ? null : state === 'needs-install' ? (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 text-helper text-slate-600">
          <p>On iPhone and iPad, reminders only work in the LedgeEaze app on your home screen. Add it first, open it from there, then come back here.</p>
          <Button variant="secondary" onClick={openInstallHelp} className="self-start">
            <Download size={15} /> Add to home screen
          </Button>
        </div>
      ) : state === 'unsupported' ? (
        <p className="rounded-xl bg-slate-50 p-3 text-helper text-slate-600">
          This browser can’t show reminders. Try Chrome, Edge or Safari, or the app on your home screen.
        </p>
      ) : state === 'blocked' ? (
        <p className="rounded-xl bg-caution-light p-3 text-helper text-slate-700">
          Notifications are blocked for LedgeEaze. Allow them in your phone’s Settings (Notifications → LedgeEaze) or
          your browser’s site settings, then come back.
        </p>
      ) : state === 'on' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-medium text-positive">On for this device</span>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await sendTestReminder()
                show(r.sent > 0 ? 'Test sent. It should arrive in a few seconds.' : 'No device got it. Turn reminders off and on again.', {
                  tone: r.sent > 0 ? 'success' : 'error',
                })
              })
            }
          >
            Send a test
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await turnOffReminders()
                setState('off')
              })
            }
          >
            Turn off
          </Button>
        </div>
      ) : (
        <Button
          disabled={busy}
          className="self-start"
          onClick={() =>
            run(async () => {
              const next = await turnOnReminders()
              setState(next)
              if (next === 'on') {
                show('Reminders are on for this device.', { tone: 'success' })
                // Turned on after today's 9 AM run? Get today's note now.
                catchUpReminders().catch(() => undefined)
              }
            })
          }
        >
          <BellRing size={15} /> Turn on reminders
        </Button>
      )}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <p className="text-helper text-slate-500">Each phone or computer is turned on separately.</p>
    </Card>
  )
}
