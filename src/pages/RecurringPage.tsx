import { RecurringLikePage } from '@/components/recurring/RecurringLikePage'

export function RecurringPage() {
  return (
    <RecurringLikePage
      kind="recurring"
      title="Recurring"
      addLabel="New recurring payment"
      emptyDescription="Recurring bills you confirm (rent, utilities, loans) will show up here."
    />
  )
}
