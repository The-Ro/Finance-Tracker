import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, FileUp, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useGlobalModals } from '@/context/GlobalModalsContext'

interface QuickAction {
  label: string
  icon: LucideIcon
  iconClassName: string
  onClick: () => void
}

/**
 * One-tap entry points under the Home hero. Arrow directions follow this
 * app's convention: up-arrow = money out (Expense), down-arrow = money in
 * (Income). Import opens the same CSV import as the top bar's Import button.
 */
export function QuickActions({ className }: { className?: string }) {
  const { openAddEntry, openImport } = useGlobalModals()
  const actions: QuickAction[] = [
    { label: 'Expense', icon: ArrowUpRight, iconClassName: 'text-danger', onClick: () => openAddEntry('expense') },
    { label: 'Income', icon: ArrowDownRight, iconClassName: 'text-positive', onClick: () => openAddEntry('income') },
    { label: 'Transfer', icon: ArrowLeftRight, iconClassName: 'text-info', onClick: () => openAddEntry('transfer') },
    { label: 'Import', icon: FileUp, iconClassName: 'text-accent-dark', onClick: openImport },
  ]

  return (
    <div role="group" aria-label="Quick actions" className={clsx('grid grid-cols-4 gap-2.5', className)}>
      {actions.map(({ label, icon: Icon, iconClassName, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="card-interactive flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-app-border bg-app-card px-1 text-xs font-semibold text-slate-800 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon size={20} strokeWidth={1.8} className={iconClassName} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
