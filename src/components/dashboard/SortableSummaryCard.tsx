import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import clsx from 'clsx'
import type { SummaryCardId } from '@/lib/dashboardSections'

interface SortableSummaryCardProps {
  id: SummaryCardId
  label: string
  children: ReactNode
}

/**
 * Wraps a summary card with its own drag handle so the 4 cards can be
 * reordered right on Home, not just via the nested list in the Customize
 * modal (that still works too -- same summaryCardOrder underneath, just a
 * second way to get at it). The handle stays visible rather than
 * hover-revealed since this has to work by touch on mobile, which has no
 * hover state at all.
 */
export function SortableSummaryCard({ id, label, children }: SortableSummaryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('relative', isDragging && 'z-10 shadow-card-lg')}
    >
      {children}
      <button
        type="button"
        aria-label={`Drag to reorder ${label} card`}
        className="absolute right-2 top-2 flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
    </div>
  )
}
