import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-bg px-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-blob-drift absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="animate-blob-drift animate-delay-6000 absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="animate-blob-drift-slow animate-delay-3000 absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )
}
