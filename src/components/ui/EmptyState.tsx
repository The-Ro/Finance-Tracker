import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-app-border bg-white/60 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent-on-light">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {description && <p className="mt-1 text-helper text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
