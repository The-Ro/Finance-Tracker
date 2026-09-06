import { useEffect, useRef, useLayoutEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  maxWidthClassName?: string
}

export function Modal({ open, onClose, title, children, footer, maxWidthClassName = 'max-w-lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // Deliberately depends only on `open`: this focus-traps and grabs initial
  // focus once when the dialog opens. Re-running it on every parent render
  // (e.g. because an inline onClose prop got a new identity while the user
  // types) would call dialogRef.current.focus() again and yank focus away
  // from whatever form field the user is typing into.
  useEffect(() => {
    if (!open) return

    function getFocusable(): NodeListOf<HTMLElement> | null {
      return (
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? null
      )
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    // Focus the first focusable field/button inside the dialog rather than the
    // dialog container itself: the container has tabIndex=-1 so it's excluded
    // from `getFocusable()`'s results, meaning a Shift+Tab from it wouldn't
    // match `document.activeElement === first` below and would fall through
    // to the browser's native "previous focusable in the document" -- which
    // is behind the modal, letting focus (and the trap) escape immediately.
    const initialFocusable = getFocusable()
    if (initialFocusable && initialFocusable.length > 0) {
      initialFocusable[0].focus()
    } else {
      dialogRef.current?.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={clsx(
          'animate-scale-in flex max-h-[90vh] w-full flex-col rounded-t-card bg-white shadow-card outline-none sm:rounded-card',
          maxWidthClassName
        )}
      >
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-app-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
