import { Pencil, Trash2 } from 'lucide-react'
import type { Rule } from '@/hooks/useRules'

interface RuleRowProps {
  rule: Rule
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

export function RuleRow({ rule, onToggle, onEdit, onDelete }: RuleRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-app-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800">
          When merchant contains <span className="font-semibold">"{rule.when_text}"</span> then{' '}
          <span className="font-semibold">{rule.then_text}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-1 text-helper text-slate-500">
          <input type="checkbox" checked={rule.enabled} onChange={onToggle} className="h-3.5 w-3.5" />
          Enabled
        </label>
        <button
          aria-label="Edit rule"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil size={14} />
        </button>
        <button
          aria-label="Delete rule"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}
