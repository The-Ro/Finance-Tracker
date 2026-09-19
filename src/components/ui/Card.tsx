import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Tailwind emits same-property utility classes alphabetically, not in
  // source order, so a caller's `bg-accent-light` (RecurringLikePage's
  // banner) or `border-red-200` (DangerZone) can lose to these defaults in
  // the generated stylesheet regardless of where they appear in `className`
  // -- omit the default whenever the caller supplies its own.
  const hasBg = className?.includes('bg-')
  // Excludes width (border-2), side (border-t/b/l/r/x/y) and style
  // (border-dashed etc.) utilities, which aren't color overrides.
  const hasBorderColor =
    className && /\bborder-(?!\d|[tblrxy]\b|solid\b|dashed\b|dotted\b|double\b|none\b|hidden\b)[a-z]/.test(className)
  return (
    <div
      className={clsx(
        'rounded-card border shadow-card',
        !hasBorderColor && 'border-app-border',
        !hasBg && 'bg-app-card',
        className
      )}
      {...props}
    />
  )
}
