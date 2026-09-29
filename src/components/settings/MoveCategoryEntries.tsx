import { useMemo, useState } from 'react'
import { ArrowRight, Shuffle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useCategories, useMoveCategory } from '@/hooks/useLookupLists'
import { useMyTransactions } from '@/hooks/useTransactions'

const PICK = 'Choose…'

/**
 * Settings -> Categories: move every entry from one category to another (e.g.
 * merge "Food" into "Dining"), optionally deleting the old one afterwards.
 * Only the user's own entries move; shared viewers' data is never touched.
 */
export function MoveCategoryEntries() {
  const { userId } = useAuth()
  const { data: categories = [], remove } = useCategories()
  const { data: transactions = [] } = useMyTransactions(userId)
  const move = useMoveCategory()
  const { show } = useToast()
  const [from, setFrom] = useState(PICK)
  const [to, setTo] = useState(PICK)
  const [deleteAfter, setDeleteAfter] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) if (t.category) m.set(t.category, (m.get(t.category) ?? 0) + 1)
    return m
  }, [transactions])

  const label = (c: string) => `${c} (${counts.get(c) ?? 0})`
  const fromOptions = categories.map(label)
  const fromName = categories.find((c) => label(c) === from) ?? null
  const toOptions = categories.filter((c) => c !== fromName)
  const n = fromName ? (counts.get(fromName) ?? 0) : 0

  const run = async () => {
    setError(null)
    if (!fromName || to === PICK) return setError('Choose both categories.')
    try {
      const moved = await move.mutateAsync({ from: fromName, to })
      if (deleteAfter && fromName !== 'Needs review') await remove.mutateAsync(fromName)
      show(`Moved ${moved} ${moved === 1 ? 'entry' : 'entries'} to ${to}${deleteAfter ? ` and deleted ${fromName}` : ''}.`)
      setFrom(PICK)
      setTo(PICK)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the entries.')
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Shuffle size={16} className="text-accent-dark" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-800">Move entries</h3>
      </div>
      <p className="text-helper text-slate-500">
        Move everything from one category to another, like merging "Food" into "Dining". Recurring payments and a
        budget move too.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">From</span>
          <Dropdown options={[PICK, ...fromOptions]} value={from} aria-label="Move entries from" onChange={(e) => setFrom(e.target.value)} />
        </div>
        <ArrowRight size={18} className="mb-3 text-slate-400" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">To</span>
          <Dropdown options={[PICK, ...toOptions]} value={to} aria-label="Move entries to" onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={deleteAfter} onChange={(e) => setDeleteAfter(e.target.checked)} className="h-4 w-4" />
        Delete {fromName ? `"${fromName}"` : 'the old category'} afterwards
      </label>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <Button onClick={run} disabled={!fromName || to === PICK || move.isPending} className="w-fit">
        {move.isPending ? 'Moving…' : fromName && to !== PICK ? `Move ${n} ${n === 1 ? 'entry' : 'entries'}` : 'Move entries'}
      </Button>
    </Card>
  )
}
