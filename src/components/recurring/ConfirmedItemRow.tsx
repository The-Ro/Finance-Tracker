import { Pencil, Trash2 } from 'lucide-react'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate } from '@/lib/format'

interface ConfirmedItemRowProps {
  item: RecurringItem
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}

export function ConfirmedItemRow({ item, onEdit, onDelete, onToggleActive }: ConfirmedItemRowProps) {
  const { format } = useFormatCurrency()
  return (
    <li className="flex items-center justify-between gap-3 border-b border-app-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
        <p className="truncate text-helper text-slate-500">
          {item.category} · {item.cadence} · next {formatShortDate(item.next_date)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{format(item.amount)}</span>
        <label className="flex items-center gap-1 text-helper text-slate-500">
          <input type="checkbox" checked={item.active} onChange={onToggleActive} className="h-3.5 w-3.5" />
          Active
        </label>
        <button
          aria-label="Edit"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil size={14} />
        </button>
        <button
          aria-label="Delete"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}
