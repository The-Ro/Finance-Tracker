import { useState } from 'react'
import clsx from 'clsx'
import { Check, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { BILL_PICKS, type BillPick } from '@/lib/billPicks'

/**
 * "Add your regular bills" from the setup checklist: tap a common bill and the
 * recurring form opens pre-filled (name, category, the loan section for an
 * EMI); saving it ticks the chip. The picker hides while the form is open so
 * only one sheet is on screen at a time.
 */
export function BillPicksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: items = [] } = useRecurringItemsRaw()
  const [pick, setPick] = useState<BillPick | null>(null)
  const added = new Set(items.map((i) => i.name.trim().toLowerCase()))

  return (
    <>
      <Modal
        open={open && !pick}
        onClose={onClose}
        title="Add your regular bills"
        footer={
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Tap one to add it. You'll set the amount, the next date and the account it's paid from, and LedgeEaze reminds you
            when it's due.
          </p>
          <div className="stagger-rows flex flex-wrap gap-2">
            {BILL_PICKS.map((p) => {
              const done = added.has(p.label.toLowerCase())
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPick(p)}
                  className={clsx(
                    'press flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                    done
                      ? 'border-positive/40 bg-positive-light text-positive'
                      : 'border-app-border bg-app-card text-slate-700 hover:border-accent hover:text-accent-dark'
                  )}
                >
                  {done && <Check size={14} strokeWidth={3} aria-hidden="true" className="animate-pop-in" />}
                  {p.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPick({ label: '', kind: 'recurring', category: '' })}
              className="press flex min-h-[40px] items-center gap-1.5 rounded-full border border-dashed border-accent px-3.5 text-sm font-semibold text-accent-dark"
            >
              <Plus size={14} aria-hidden="true" /> Something else
            </button>
          </div>
        </div>
      </Modal>
      <RecurringFormModal
        open={!!pick}
        onClose={() => setPick(null)}
        kind={pick?.kind ?? 'recurring'}
        prefill={pick ? { name: pick.label, category: pick.category || undefined, loan: pick.loan } : null}
      />
    </>
  )
}
