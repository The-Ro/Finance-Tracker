import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useBudgets } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useLookupLists'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { suggestBudgets } from '@/lib/budgetSuggestions'
import { parseBalance } from '@/lib/onboardingAccounts'
import { todayISO } from '@/lib/format'
import { FormError } from '@/components/ui/FieldError'

interface Row {
  category: string
  amount: string
  on: boolean
  average: number
}

const ADD_ANOTHER = 'Add another category…'

/**
 * "Set a monthly budget" from the setup checklist: the biggest spending
 * categories with a suggested limit (a little over the usual), editable and
 * each switchable off, plus any other category. Saves the ones left on.
 */
export function BudgetSuggestionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId } = useAuth()
  const { data: transactions = [] } = useMyTransactions(userId)
  const budgets = useBudgets()
  const { expense: categories } = useCategories()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const existing = useMemo(() => new Set((budgets.data ?? []).map((b) => b.category)), [budgets.data])

  // Fresh suggestions each time the sheet opens.
  useEffect(() => {
    if (!open) return
    const suggested = suggestBudgets(transactions, todayISO(), existing).filter((s) => categories.includes(s.category))
    setRows(suggested.map((s) => ({ category: s.category, amount: s.limit ? String(s.limit) : '', on: true, average: s.average })))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const others = categories.filter((c) => c !== 'Needs review' && !existing.has(c) && !rows.some((r) => r.category === c))
  const patch = (i: number, change: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)))

  const save = async () => {
    setError(null)
    const picked = rows.filter((r) => r.on)
    for (const r of picked) {
      const n = parseBalance(r.amount)
      if (n === null || n <= 0) return setError(`Enter a monthly limit for ${r.category}, or switch it off.`)
    }
    setSaving(true)
    try {
      for (const r of picked) {
        await budgets.create.mutateAsync({ category: r.category, monthlyLimit: parseBalance(r.amount)!, rollover: false })
      }
      show(picked.length === 1 ? 'Budget added.' : `${picked.length} budgets added.`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the budgets.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set a monthly budget"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !rows.some((r) => r.on)}>
            {saving ? 'Saving…' : 'Save budgets'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          {rows.some((r) => r.average > 0)
            ? 'Based on the last three months, a little over what you usually spend. Change any amount.'
            : 'Pick a monthly limit for the places your money usually goes.'}
        </p>
        <ul className="stagger-rows flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={r.category}
              className={clsx('flex items-center gap-3 rounded-xl border p-3 transition-colors', r.on ? 'border-accent/40' : 'border-app-border opacity-60')}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={r.on}
                aria-label={`Budget for ${r.category}`}
                onClick={() => patch(i, { on: !r.on })}
                className={clsx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                  r.on ? 'border-accent bg-accent text-white' : 'border-slate-300 bg-white'
                )}
              >
                {r.on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{r.category}</p>
                {r.average > 0 && <p className="text-helper text-slate-500">Usually {format(r.average)} a month</p>}
              </div>
              <input
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => patch(i, { amount: e.target.value, on: true })}
                placeholder="Limit"
                aria-label={`${r.category} monthly limit`}
                className="min-h-[40px] w-28 rounded-lg border border-app-border bg-white px-3 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <Dropdown
            options={[ADD_ANOTHER, ...others]}
            value={ADD_ANOTHER}
            aria-label="Add another category"
            onChange={(e) => {
              if (e.target.value === ADD_ANOTHER) return
              setRows((rs) => [...rs, { category: e.target.value, amount: '', on: true, average: 0 }])
            }}
          />
        )}
        <FormError message={error} />
      </div>
    </Modal>
  )
}
