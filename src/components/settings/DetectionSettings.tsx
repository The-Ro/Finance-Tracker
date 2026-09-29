import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRecurringData, useRecurringMutations } from '@/hooks/useRecurring'

export function DetectionSettings() {
  const { dismissedCount } = useRecurringData('recurring')
  const { restoreIgnored } = useRecurringMutations()

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="text-sm font-semibold text-slate-800">Find repeat payments</h3>
      <p className="text-helper text-slate-500">
        LedgeEaze looks for payments you make again and again, and suggests them on the Recurring and
        Subscriptions pages. Nothing is added until you tap Keep. Tap Ignore to hide a suggestion.
      </p>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">{dismissedCount} ignored suggestion{dismissedCount === 1 ? '' : 's'}</span>
        <Button
          variant="secondary"
          onClick={() => restoreIgnored.mutate()}
          disabled={dismissedCount === 0 || restoreIgnored.isPending}
        >
          Show ignored ones again
        </Button>
      </div>
    </Card>
  )
}
