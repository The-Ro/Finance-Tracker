import clsx from 'clsx'

export type TransactionScope = 'mine' | 'everyone'

interface ScopeToggleProps {
  value: TransactionScope
  onChange: (value: TransactionScope) => void
}

export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  return (
    <div className="flex rounded-lg border border-app-border bg-white p-1">
      {(['mine', 'everyone'] as TransactionScope[]).map((scope) => (
        <button
          key={scope}
          type="button"
          onClick={() => onChange(scope)}
          className={clsx(
            'min-h-[36px] rounded-md px-3 text-sm font-medium transition-colors',
            value === scope ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'
          )}
        >
          {scope === 'mine' ? 'My transactions' : "Everyone's transactions"}
        </button>
      ))}
    </div>
  )
}
