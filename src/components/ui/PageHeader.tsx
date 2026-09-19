import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Usually just the page name, but ReactNode (not string) so a page like
   *  Dashboard can slot a small icon button right next to the title text
   *  without reaching for a second, differently-shaped header row. */
  title: ReactNode
  actions?: ReactNode
}

/** The title + actions row repeated (byte-for-byte, in some cases) across
 *  Dashboard, Transactions, Budgets, Goals, Rules, and Recurring/Subscriptions
 *  -- pulled out once so the serif page-title treatment only needs to change
 *  in one place. */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-slate-900">{title}</h1>
      {actions}
    </div>
  )
}
