import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronRight, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface AccountsSectionCardProps {
  id?: string
  title: string
  description: string
  addLabel: string
  onAdd: () => void
  addDisabled?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function AccountsSectionCard({ id, title, description, addLabel, onAdd, addDisabled, children, footer }: AccountsSectionCardProps) {
  return (
    <Card id={id} className="scroll-mt-24 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-helper text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          aria-label={addLabel}
          className="press inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-app-border px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>
      {children}
      {footer}
    </Card>
  )
}

interface AccountRowProps {
  icon: ReactNode
  name: string
  subline: string
  /** Right-hand figure (balance / owed); optional. */
  value?: ReactNode
  onClick: () => void
  ariaLabel: string
  closed?: boolean
}

export function AccountRow({ icon, name, subline, value, onClick, ariaLabel, closed = false }: AccountRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="-mx-2 flex min-h-[56px] w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <span
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            closed ? 'bg-slate-100 text-slate-500' : 'bg-accent-light text-accent-on-light'
          )}
        >
          {icon}
        </span>
        <span className={clsx('flex min-w-0 flex-1 flex-col', closed && 'opacity-70')}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
            {closed && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                Closed
              </span>
            )}
          </span>
          <span className="truncate text-helper text-slate-500">{subline}</span>
        </span>
        {value}
        <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>
    </li>
  )
}

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="stagger-rows flex flex-col divide-y divide-app-border">{children}</ul>
}

export function RowValue({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' | 'positive' | 'muted' }) {
  return (
    <span
      className={clsx(
        'shrink-0 text-right tabular-nums',
        tone === 'muted' ? 'text-helper text-slate-500' : 'font-serif text-base font-semibold',
        tone === 'danger' && 'text-danger',
        tone === 'positive' && 'text-positive',
        tone === 'default' && 'text-slate-900'
      )}
    >
      {children}
    </span>
  )
}

export function EmptyRows({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed border-app-border px-3 py-4 text-center text-helper text-slate-500">{children}</p>
}
