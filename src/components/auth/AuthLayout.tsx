import type { ReactNode } from 'react'
import { BrandHeader } from '@/components/ui/BrandHeader'

interface AuthLayoutProps {
  children: ReactNode
  /** Adds a left brand panel on wide viewports, turning this into a
   *  two-column split-screen layout -- used for the two primary entry
   *  points (Login, Signup). Forgot/Reset password omit this and keep the
   *  simpler single-column centered-card layout, since they're secondary,
   *  rarely-visited flows. Collapses to just the form below `lg`. */
  split?: boolean
  /** Short one-line value-proposition headline shown in the brand panel.
   *  Only rendered when `split` is true. */
  headline?: ReactNode
  /** Optional supporting line under the headline. */
  supportingText?: ReactNode
}

export function AuthLayout({ children, split = false, headline, supportingText }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-app-bg">
      {split && (
        <div className="relative hidden w-[44%] shrink-0 overflow-hidden bg-gradient-to-br from-accent-light via-accent-light to-accent/25 px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-blob-drift absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
            <div className="animate-blob-drift-slow animate-delay-3000 absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-accent-dark/20 blur-3xl" />
          </div>

          <div className="relative z-10">
            <BrandHeader />
          </div>

          {headline && (
            <div className="relative z-10 flex max-w-sm flex-col gap-3">
              <p className="font-serif text-3xl font-medium leading-tight text-slate-900">{headline}</p>
              {supportingText && <p className="text-sm leading-relaxed text-slate-600">{supportingText}</p>}
            </div>
          )}
        </div>
      )}

      <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-4 py-10">
        {!split && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-blob-drift absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
            <div className="animate-blob-drift animate-delay-6000 absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
            <div className="animate-blob-drift-slow animate-delay-3000 absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
          </div>
        )}
        <div className="relative z-10 w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
