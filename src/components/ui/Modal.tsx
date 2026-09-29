import { useEffect, useRef, useLayoutEffect, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Trash2, X } from 'lucide-react'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /**
   * Icon buttons in the header, left of the close X -- edit sheets put Save
   * (check) and Delete (trash) here instead of a Cancel / Save footer
   * (SheetSaveButton / SheetDeleteButton); X is the cancel.
   */
  headerActions?: ReactNode
  maxWidthClassName?: string
  /** Lets a caller scroll the body back to top itself -- e.g. a form with a
   *  validation error rendered up top, so it's visible even if the user had
   *  already scrolled down past it before submitting. */
  contentRef?: Ref<HTMLDivElement>
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerActions,
  maxWidthClassName = 'max-w-lg',
  contentRef,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // Without this, the page behind a centered modal can still scroll (drag,
  // wheel, or the browser auto-scrolling the underlying page to keep a
  // newly-focused element in view) -- on a short viewport that reads as a
  // flash of blank space/background page peeking out as the modal opens.
  // Locks `<html>`, not `<body>` -- `document.scrollingElement` here is the
  // root element, so locking body alone is a no-op and the page still
  // scrolls underneath. Also compensates for the scrollbar's width: once
  // it's actually locked, the scrollbar disappears and the page reflows
  // wider by that amount -- since `<html>` has no background color, that
  // reveals a sliver of the browser's default white canvas until it settles.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const scrollbarWidth = window.innerWidth - root.clientWidth
    const originalOverflow = root.style.overflow
    const originalPaddingRight = root.style.paddingRight
    root.style.overflow = 'hidden'
    if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      root.style.overflow = originalOverflow
      root.style.paddingRight = originalPaddingRight
    }
  }, [open])

  // iOS doesn't shrink the layout viewport for the on-screen keyboard, so a
  // bottom sheet pinned to it ends up half behind the keyboard, often with
  // the field being typed into hidden. On phones, size the overlay to the
  // visual viewport instead: the sheet then sits just above the keyboard,
  // and its percentage max-height shrinks to fit the space left.
  useEffect(() => {
    const vv = window.visualViewport
    const overlay = overlayRef.current
    if (!open || !vv || !overlay || !window.matchMedia('(max-width: 639px)').matches) return
    function sync() {
      overlay!.style.top = `${vv!.offsetTop}px`
      overlay!.style.height = `${vv!.height}px`
    }
    function onResize() {
      sync()
      const active = document.activeElement
      if (active instanceof HTMLElement && dialogRef.current?.contains(active)) {
        active.scrollIntoView({ block: 'nearest' })
      }
    }
    sync()
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', sync)
      overlay.style.top = ''
      overlay.style.height = ''
    }
  }, [open])

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
        // An open DateField/Dropdown inside the dialog consumes Escape (capture
        // phase + preventDefault) so it closes only itself, not the form.
        if (e.defaultPrevented) return
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

  // Portaled to <body>: this component previously rendered inline wherever
  // it was used, so a `position: fixed` dialog sitting inside a page that
  // itself has a transform-based entrance animation (`animate-fade-in-up`,
  // applied to the whole page content in AppShell.tsx) had its "fixed"
  // positioning computed relative to that transformed ancestor instead of
  // the viewport -- a CSS rule, not a bug in this component: any element
  // with a `transform` becomes the containing block for its `position:
  // fixed` descendants. In practice the modal rendered squashed into that
  // ancestor's box, pushed near the top of the page with its title bar
  // clipped off above the visible area. Portaling escapes the page's DOM
  // subtree entirely, so it's never nested inside that (or any future)
  // transformed ancestor again.
  return createPortal(
    <div
      ref={overlayRef}
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={clsx(
          // Phones: a bottom sheet that slides up (easier to reach one-handed);
          // sm and up: the centered card it always was. The phone max-height is
          // a % of the overlay (which tracks the visible area and the keyboard,
          // unlike vh on iOS) and always clears the status bar / Dynamic Island.
          'animate-sheet-up flex max-h-[min(92%,calc(100%_-_var(--safe-top)_-_0.5rem))] w-full flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-card outline-none sm:animate-scale-in sm:max-h-[90vh] sm:rounded-card sm:pb-0',
          maxWidthClassName
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h2 id="modal-title" className="min-w-0 truncate text-base font-semibold text-slate-900">
            {title}
          </h2>
          <div className="-mr-1.5 flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button
              aria-label="Close"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        {footer && <div className="border-t border-app-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

/** Header Save for edit sheets (Modal headerActions): a filled check; submits `form` or calls onClick. */
export function SheetSaveButton({
  onClick,
  form,
  busy,
  label = 'Save',
}: {
  onClick?: () => void
  /** Submit this form (by id) instead -- keeps the form's own validation and Enter-to-save. */
  form?: string
  busy?: boolean
  label?: string
}) {
  return (
    <button
      type={form ? 'submit' : 'button'}
      form={form}
      aria-label={busy ? 'Saving' : label}
      title={label}
      onClick={onClick}
      disabled={busy}
      className="press flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-card hover:bg-accent-dark disabled:opacity-60"
    >
      {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Check size={18} strokeWidth={2.6} aria-hidden="true" />}
    </button>
  )
}

/** Header Delete for edit sheets (Modal headerActions): a red trash. */
export function SheetDeleteButton({ onClick, disabled, label = 'Delete' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full text-danger hover:bg-danger-light disabled:opacity-50"
    >
      <Trash2 size={17} aria-hidden="true" />
    </button>
  )
}
