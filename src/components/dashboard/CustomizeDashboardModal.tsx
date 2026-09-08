import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  DASHBOARD_SECTION_LABELS,
  SUMMARY_CARD_LABELS,
  type DashboardSectionId,
  type SummaryCardId,
} from '@/lib/dashboardSections'

interface CustomizeDashboardModalProps {
  open: boolean
  onClose: () => void
}

interface SortableRowProps {
  id: DashboardSectionId
  hidden: boolean
  onToggleHidden: () => void
  /** Only "summary" has a nested card list to collapse -- every other row
   *  omits these and gets no chevron. */
  expanded?: boolean
  onToggleExpanded?: () => void
}

function SortableRow({ id, hidden, onToggleHidden, expanded, onToggleExpanded }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'flex items-center gap-2 rounded-lg border border-app-border bg-white px-2 py-2.5',
        hidden && 'opacity-50',
        isDragging && 'relative z-10 shadow-card-lg'
      )}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${DASHBOARD_SECTION_LABELS[id]}`}
        className="flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      {onToggleExpanded && (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${DASHBOARD_SECTION_LABELS[id]} card order` : `Expand ${DASHBOARD_SECTION_LABELS[id]} card order`}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      )}
      <span className="flex-1 text-sm text-slate-700">{DASHBOARD_SECTION_LABELS[id]}</span>
      <button
        type="button"
        aria-label={hidden ? `Show ${DASHBOARD_SECTION_LABELS[id]} on Home` : `Hide ${DASHBOARD_SECTION_LABELS[id]} from Home`}
        aria-pressed={!hidden}
        onClick={onToggleHidden}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

interface SummaryCardRowProps {
  id: SummaryCardId
  hidden: boolean
  onToggleHidden: () => void
}

function SummaryCardRow({ id, hidden, onToggleHidden }: SummaryCardRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'flex items-center gap-2 rounded-lg border border-app-border bg-white px-2 py-2',
        hidden && 'opacity-50',
        isDragging && 'relative z-10 shadow-card-lg'
      )}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${SUMMARY_CARD_LABELS[id]} card`}
        className="flex h-7 w-7 shrink-0 touch-none cursor-grab items-center justify-center text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <span className="flex-1 text-helper text-slate-600">{SUMMARY_CARD_LABELS[id]}</span>
      <button
        type="button"
        aria-label={hidden ? `Show ${SUMMARY_CARD_LABELS[id]} card on Home` : `Hide ${SUMMARY_CARD_LABELS[id]} card from Home`}
        aria-pressed={!hidden}
        onClick={onToggleHidden}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </li>
  )
}

export function CustomizeDashboardModal({ open, onClose }: CustomizeDashboardModalProps) {
  const { data, updateDashboardLayout } = useUserSettings()
  const order = data?.dashboardOrder ?? []
  const hidden = data?.dashboardHidden ?? []
  const summaryCardOrder = data?.summaryCardOrder ?? []
  const summaryCardHidden = data?.summaryCardHidden ?? []
  // Purely a this-session UI convenience (not a saved preference) -- starts
  // collapsed so the modal isn't dominated by a 5-row nested list before
  // you've even looked at the other sections.
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as DashboardSectionId)
    const newIndex = order.indexOf(over.id as DashboardSectionId)
    if (oldIndex === -1 || newIndex === -1) return
    updateDashboardLayout.mutate({ order: arrayMove(order, oldIndex, newIndex) })
  }

  const handleSummaryCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = summaryCardOrder.indexOf(active.id as SummaryCardId)
    const newIndex = summaryCardOrder.indexOf(over.id as SummaryCardId)
    if (oldIndex === -1 || newIndex === -1) return
    updateDashboardLayout.mutate({ summaryCardOrder: arrayMove(summaryCardOrder, oldIndex, newIndex) })
  }

  const toggleHidden = (id: DashboardSectionId) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    updateDashboardLayout.mutate({ hidden: next })
  }

  const toggleSummaryCardHidden = (id: SummaryCardId) => {
    const next = summaryCardHidden.includes(id)
      ? summaryCardHidden.filter((h) => h !== id)
      : [...summaryCardHidden, id]
    updateDashboardLayout.mutate({ summaryCardHidden: next })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize dashboard"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-helper text-slate-500">
          Drag to reorder, tap the eye to hide from Home, or the arrow to expand a section's card order.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {order.map((id) => (
                <li key={id} className="flex flex-col gap-1.5">
                  <SortableRow
                    id={id}
                    hidden={hidden.includes(id)}
                    onToggleHidden={() => toggleHidden(id)}
                    expanded={id === 'summary' ? summaryExpanded : undefined}
                    onToggleExpanded={id === 'summary' ? () => setSummaryExpanded((v) => !v) : undefined}
                  />
                  {/* The summary cards get their own nested drag order,
                      separate from where "Summary cards" itself sits among
                      the other sections -- a second, independent DndContext
                      so its grip handles don't fight the outer list's. */}
                  {id === 'summary' && summaryExpanded && (
                    <div className="ml-6 flex flex-col gap-1.5 border-l-2 border-app-border pl-3">
                      <p className="text-helper text-slate-400">Card order</p>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleSummaryCardDragEnd}
                      >
                        <SortableContext items={summaryCardOrder} strategy={verticalListSortingStrategy}>
                          <ul className="flex flex-col gap-1.5">
                            {summaryCardOrder.map((cardId) => (
                              <SummaryCardRow
                                key={cardId}
                                id={cardId}
                                hidden={summaryCardHidden.includes(cardId)}
                                onToggleHidden={() => toggleSummaryCardHidden(cardId)}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </Modal>
  )
}
