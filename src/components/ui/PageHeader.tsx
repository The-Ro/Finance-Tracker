import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
      <h1 className="flex min-w-0 items-center gap-2 font-serif text-2xl font-semibold text-slate-900">{title}</h1>
      {actions}
    </div>
  )
}

/** The page's primary "create" action: "+ New" on phones (the page title
 *  already says what), the full label from sm up. */
export function PageHeaderAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} aria-label={label} className="shrink-0 pl-3.5">
      <Plus size={16} aria-hidden="true" />
      <span className="sm:hidden">New</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
