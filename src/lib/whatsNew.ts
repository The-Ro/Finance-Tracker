// Keep in sync with package.json's "version" -- bumped together whenever a
// batch of user-facing changes ships.
export const APP_VERSION = '1.1.0'

export const CURRENT_WHATS_NEW_VERSION = '2026-09-10'

export const WHATS_NEW_ITEMS: string[] = [
  'Overdue recurring bills and subscriptions now show up in the notification bell, with one-tap "mark as paid".',
  'Marking something paid logs a real expense transaction and updates your account balance, instead of just moving the due date.',
  "A heads-up when an account can't currently cover an upcoming bill, right on the item.",
  'Recurring/subscription category pickers now show only relevant categories — plus any category you added yourself.',
  'Fixed account deletion failing for anyone who had added their own custom account, category, or tag.',
  "Fixed a timezone bug that could log a transaction, or flag something overdue, a day off from your actual local date.",
  'Credit/debit totals now shown next to the Transactions page title.',
  'Cash flow chart: click Income or Spending in the legend to isolate it.',
  'New app icon.',
]
