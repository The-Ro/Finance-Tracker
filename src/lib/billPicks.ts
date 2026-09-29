// One-tap starting points for "Add your regular bills" (setup checklist).
// Each opens the recurring form pre-filled; the user still sets the amount,
// date and account. `category` is a suggestion -- the form falls back to its
// own list when the user doesn't have that category.

import type { RecurringKind } from '@/types/database.types'

export interface BillPick {
  label: string
  kind: RecurringKind
  category: string
  /** Opens the form with the loan / EMI section switched on. */
  loan?: boolean
}

export const BILL_PICKS: BillPick[] = [
  { label: 'Rent', kind: 'recurring', category: 'Housing' },
  { label: 'Loan EMI', kind: 'recurring', category: 'Fees & charges', loan: true },
  { label: 'Electricity', kind: 'recurring', category: 'Utilities' },
  { label: 'Mobile', kind: 'recurring', category: 'Utilities' },
  { label: 'Internet', kind: 'recurring', category: 'Utilities' },
  { label: 'Insurance', kind: 'recurring', category: 'Insurance' },
  { label: 'SIP / investment', kind: 'recurring', category: 'Other' },
  { label: 'School / tuition fees', kind: 'recurring', category: 'Education' },
  { label: 'Gym', kind: 'recurring', category: 'Health' },
  { label: 'Netflix', kind: 'subscription', category: 'Subscriptions' },
  { label: 'Spotify', kind: 'subscription', category: 'Subscriptions' },
  { label: 'Amazon Prime', kind: 'subscription', category: 'Subscriptions' },
  { label: 'YouTube Premium', kind: 'subscription', category: 'Subscriptions' },
  { label: 'Disney+ Hotstar', kind: 'subscription', category: 'Subscriptions' },
]
