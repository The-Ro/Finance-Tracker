import { RecurringLikePage } from '@/components/recurring/RecurringLikePage'

export function SubscriptionsPage() {
  return (
    <RecurringLikePage
      kind="subscription"
      title="Subscriptions"
      addLabel="New subscription"
      emptyDescription="Subscriptions you confirm (streaming, software, memberships) will show up here."
    />
  )
}
