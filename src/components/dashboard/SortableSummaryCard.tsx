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
 * The whole card is the drag surface (press and hold anywhere, not just the
 * grip icon) -- attributes/listeners go on the outer div, and the grip icon
 * is purely decorative, just a visual "this is draggable" hint riding along
 * via event bubbling. Deliberately NOT touch-action:none here: the
 * DashboardPage sensor setup uses a TouchSensor with a hold delay
 * specifically so a normal scroll-swipe starting on a card passes straight
 * through to the browser instead of getting captured as a drag attempt --
 * forcing touch-action:none on the whole card would defeat that by blocking
 * native scrolling the instant a finger lands on it.
 */
export function SortableSummaryCard({ id, label, children }: SortableSummaryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`${label} card, press and hold to drag and reorder`}
      className={clsx(
        'relative select-none cursor-grab active:cursor-grabbing',
        isDragging && 'z-10 shadow-card-lg'
      )}
      {...attributes}
      {...listeners}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-300"
      >
        <GripVertical size={14} />
      </span>
    </div>
  )
}
