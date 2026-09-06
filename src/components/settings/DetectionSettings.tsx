import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRecurringData, useRecurringMutations } from '@/hooks/useRecurring'

export function DetectionSettings() {
  const { dismissedCount } = useRecurringData('recurring')
  const { restoreIgnored } = useRecurringMutations()

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="text-sm font-semibold text-slate-800">Automatic detection</h3>
      <p className="text-helper text-slate-500">
        Ledgerly looks for repeating expenses in your own transactions to suggest recurring payments and
        subscriptions. It never confirms one automatically - you choose Keep or Ignore on each suggestion,
        or add one yourself on the Recurring or Subscriptions pages.
      </p>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">{dismissedCount} ignored suggestion{dismissedCount === 1 ? '' : 's'}</span>
        <Button
          variant="secondary"
          onClick={() => restoreIgnored.mutate()}
          disabled={dismissedCount === 0 || restoreIgnored.isPending}
        >
          Restore ignored suggestions
        </Button>
      </div>
    </Card>
  )
}
