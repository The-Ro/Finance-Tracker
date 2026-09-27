import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import '@/styles/auth.css'

// Small motion building blocks shared by the four auth pages (Login, Signup,
// Forgot password, Reset password). The keyframes live in src/styles/auth.css,
// all inside a prefers-reduced-motion: no-preference block, so with reduced
// motion each of these renders straight in its final state.

/** Rises into place on mount; `index` sets its turn in the stagger (70ms apart). */
export function AuthRise({
  index,
  className,
  children,
}: {
  index: number
  className?: string
  children: ReactNode
}) {
  return (
    <div className={clsx('auth-rise', className)} style={{ '--auth-i': index } as CSSProperties}>
      {children}
    </div>
  )
}

/** Form error: fades in (InlineMessage) and shakes once. Give it a `key` that
 *  changes per submit attempt so a repeated, identical error shakes again. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="animate-shake">
      <InlineMessage tone="error">{message}</InlineMessage>
    </div>
  )
}

/** Full-width submit button with a spinner beside the in-progress label. */
export function AuthSubmitButton({
  loading,
  loadingLabel,
  tabIndex,
  children,
}: {
  loading: boolean
  loadingLabel: string
  tabIndex?: number
  children: ReactNode
}) {
  return (
    <Button type="submit" disabled={loading} aria-busy={loading || undefined} tabIndex={tabIndex} className="w-full">
      {loading && (
        <span
          aria-hidden="true"
          className="auth-spinner h-4 w-4 shrink-0 rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {loading ? loadingLabel : children}
    </Button>
  )
}

/** Success state: a check badge pops in and its tick draws, then the message.
 *  `title` is rendered as the page's h1 -- only pass it when the layout has
 *  no title of its own (Signup's "Check your email"). */
export function AuthSuccess({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-center">
      <span
        aria-hidden="true"
        className="auth-success-badge flex h-14 w-14 items-center justify-center rounded-full bg-positive-light text-positive"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
          <path
            className="auth-success-check"
            pathLength={1}
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {title && <h1 className="font-serif text-2xl font-semibold text-slate-900">{title}</h1>}
      <p className="text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  )
}

/** Small inline spinner for non-button waits (Reset password's session check). */
export function AuthSpinner() {
  return (
    <span
      aria-hidden="true"
      className="auth-spinner inline-block h-4 w-4 shrink-0 rounded-full border-2 border-app-border border-t-accent-dark"
    />
  )
}
