import type { ReactNode } from 'react'
import { BrandHeader, BrandMark } from '@/components/ui/BrandHeader'
import { Card } from '@/components/ui/Card'
import { AuthRise } from './AuthMotion'
import { AuthShowcase } from './AuthShowcase'

interface AuthLayoutProps {
  children: ReactNode
  /** One-line value proposition: large in the desktop brand panel, and in
   *  the compact header above the card on narrower screens. */
  headline: string
  /** Optional supporting line under the headline (desktop brand panel only). */
  supportingText?: string
  /** The card's h1. Omit it when the content brings its own heading (Signup's
   *  "Check your email" success state). */
  title?: string
  /** Short line under the title. */
  subtitle?: ReactNode
  /** Links under the card ("Don't have an account? Sign up"). */
  footer?: ReactNode
}

/** Shared frame for Login, Signup, Forgot password and Reset password.
 *
 *  lg+: split screen -- an accent-tinted brand panel (large mark, Fraunces
 *  headline, benefit lines and the animated savings illustration) beside the
 *  form card. Below lg the panel is dropped for a compact mark + headline
 *  header above the card, with no decoration.
 *
 *  Everything rises in on a 70ms stagger (AuthRise); with reduced motion it
 *  all simply renders in place. */
export function AuthLayout({ children, headline, supportingText, title, subtitle, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-app-bg">
      <aside className="relative hidden w-[46%] max-w-[760px] shrink-0 flex-col gap-10 overflow-hidden bg-accent-light px-14 py-12 lg:flex">
        <svg
          aria-hidden="true"
          viewBox="0 0 640 640"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="pointer-events-none absolute -right-56 -top-44 h-[640px] w-[640px] text-accent-on-light opacity-[0.14]"
        >
          <circle cx="320" cy="320" r="300" />
          <circle cx="320" cy="320" r="220" />
          <circle cx="320" cy="320" r="140" />
        </svg>

        <AuthRise index={0} className="relative flex items-center gap-4">
          <BrandMark className="h-20 w-20" />
          <span className="font-serif text-3xl font-semibold text-accent-on-light">LedgeEaze</span>
        </AuthRise>

        <div className="relative flex max-w-md flex-col gap-4">
          <AuthRise index={1}>
            <p className="font-serif text-4xl font-medium leading-[1.15] text-accent-on-light">{headline}</p>
          </AuthRise>
          {supportingText && (
            <AuthRise index={2}>
              <p className="text-body text-accent-on-light opacity-80">{supportingText}</p>
            </AuthRise>
          )}
        </div>

        <div className="relative mt-auto">
          <AuthShowcase startIndex={3} />
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <AuthRise index={0} className="mb-6 flex flex-col gap-4 lg:hidden">
            <BrandHeader />
            <p className="font-serif text-2xl font-medium leading-snug text-slate-900">{headline}</p>
          </AuthRise>

          <AuthRise index={1}>
            <Card className="auth-form p-6 sm:p-8">
              {title && <h1 className="font-serif text-2xl font-semibold text-slate-900">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
              <div className={title || subtitle ? 'mt-6' : undefined}>{children}</div>
            </Card>
          </AuthRise>

          {footer && (
            <AuthRise index={6} className="mt-5 text-center text-sm text-slate-500">
              {footer}
            </AuthRise>
          )}
        </div>
      </main>
    </div>
  )
}
