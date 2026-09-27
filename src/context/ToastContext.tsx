import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  leaving: boolean
  action?: ToastAction
}

interface ToastOptions {
  tone?: ToastTone
  duration?: number
  /** Optional button on the toast (e.g. "Undo"). Clicking it runs onClick and dismisses the toast. */
  action?: ToastAction
}

interface ToastContextValue {
  toasts: ToastItem[]
  /** Returns the toast's id (callers that don't need it can ignore it). */
  show: (message: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
  /** Holds a toast on screen while it's hovered or focused, so an action like Undo can't vanish mid-reach. */
  pause: (id: number) => void
  resume: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DEFAULT_DURATION = 3000
/** Toasts with an action stay longer: there's something to do, not just read. */
const ACTION_DURATION = 6000
const EXIT_ANIMATION_MS = 150

interface Timer {
  handle: ReturnType<typeof setTimeout> | null
  remaining: number
  startedAt: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, Timer>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer?.handle) clearTimeout(timer.handle)
    timers.current.delete(id)
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_ANIMATION_MS)
  }, [])

  const schedule = useCallback(
    (id: number, ms: number) => {
      timers.current.set(id, { handle: setTimeout(() => dismiss(id), ms), remaining: ms, startedAt: Date.now() })
    },
    [dismiss]
  )

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [
        ...prev,
        { id, message, tone: options?.tone ?? 'success', leaving: false, action: options?.action },
      ])
      schedule(id, options?.duration ?? (options?.action ? ACTION_DURATION : DEFAULT_DURATION))
      return id
    },
    [schedule]
  )

  const pause = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (!timer?.handle) return
    clearTimeout(timer.handle)
    timers.current.set(id, { ...timer, handle: null, remaining: timer.remaining - (Date.now() - timer.startedAt) })
  }, [])

  const resume = useCallback(
    (id: number) => {
      const timer = timers.current.get(id)
      if (!timer || timer.handle) return
      // A short grace period so moving the pointer off doesn't snap it away instantly.
      schedule(id, Math.max(timer.remaining, 1500))
    },
    [schedule]
  )

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss, pause, resume }}>{children}</ToastContext.Provider>
  )
}

export function useToast(): Pick<ToastContextValue, 'show'> {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return { show: ctx.show }
}

export function useToastList(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastList must be used within ToastProvider')
  return ctx
}
