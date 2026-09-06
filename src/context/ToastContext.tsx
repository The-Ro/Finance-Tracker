import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  leaving: boolean
}

interface ToastOptions {
  tone?: ToastTone
  duration?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  show: (message: string, options?: ToastOptions) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DEFAULT_DURATION = 3000
const EXIT_ANIMATION_MS = 150

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_ANIMATION_MS)
  }, [])

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, tone: options?.tone ?? 'success', leaving: false }])
      setTimeout(() => dismiss(id), options?.duration ?? DEFAULT_DURATION)
    },
    [dismiss]
  )

  return <ToastContext.Provider value={{ toasts, show, dismiss }}>{children}</ToastContext.Provider>
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
