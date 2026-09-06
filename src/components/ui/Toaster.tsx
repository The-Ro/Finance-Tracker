import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'
import { useToastList, type ToastTone } from '@/context/ToastContext'

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'text-positive',
  error: 'text-red-600',
  info: 'text-info',
}

export function Toaster() {
  const { toasts, dismiss } = useToastList()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end md:px-0"
    >
      {toasts.map((toast) => {
        const Icon = TONE_ICON[toast.tone]
        return (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-app-border bg-app-card px-4 py-3 text-sm text-slate-800 shadow-card-lg',
              toast.leaving ? 'animate-toast-out' : 'animate-toast-in'
            )}
          >
            <Icon size={17} className={clsx('shrink-0', TONE_CLASSES[toast.tone])} />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
