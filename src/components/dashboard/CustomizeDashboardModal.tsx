import { ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useUserSettings } from '@/hooks/useUserSettings'
import { DASHBOARD_SECTION_LABELS, type DashboardSectionId } from '@/lib/dashboardSections'

interface CustomizeDashboardModalProps {
  open: boolean
  onClose: () => void
}

export function CustomizeDashboardModal({ open, onClose }: CustomizeDashboardModalProps) {
  const { data, updateDashboardLayout } = useUserSettings()
  const order = data?.dashboardOrder ?? []
  const hidden = data?.dashboardHidden ?? []

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateDashboardLayout.mutate({ order: next })
  }

  const toggleHidden = (id: DashboardSectionId) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    updateDashboardLayout.mutate({ hidden: next })
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
        <p className="text-helper text-slate-500">Choose what shows on Home, and in what order.</p>
        <ul className="flex flex-col gap-1.5">
          {order.map((id, i) => {
            const isHidden = hidden.includes(id)
            return (
              <li
                key={id}
                className={clsx(
                  'flex items-center gap-3 rounded-lg border border-app-border px-3 py-2.5',
                  isHidden && 'opacity-50'
                )}
              >
                <label className="flex flex-1 items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggleHidden(id)}
                    className="h-4 w-4 shrink-0 rounded border-app-border"
                  />
                  {DASHBOARD_SECTION_LABELS[id]}
                </label>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${DASHBOARD_SECTION_LABELS[id]} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${DASHBOARD_SECTION_LABELS[id]} down`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}
