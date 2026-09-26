// Keep in sync with package.json's "version" -- bumped together whenever a
// batch of user-facing changes ships.
export const APP_VERSION = '1.2.0'

export const CURRENT_WHATS_NEW_VERSION = '2026-09-26'

export const WHATS_NEW_ITEMS: string[] = [
  'Log expenses and income in another currency: it's converted to yours using that day's exchange rate, which you can adjust.',
  'Set a starting balance for each account (Settings → Financial setup) so balances match your real accounts.',
  'Transactions search and filters now cover your whole history, with "Load more" instead of a 5,000-row limit.',
  'Select several transactions at once to change their category or delete them.',
  'Export your transactions to CSV.',
  'New "Duplicates" check finds entries that look like the same purchase logged twice.',
  'Budgets now show how you did last month.',
  'Works offline: you'll see your last-saved data when there's no connection.',
  'Rules match messy bank merchant names (like "UBER *TRIP 8812345") more reliably.',
  'Sharing now finds people by their exact email address, so your name and email aren't visible to everyone.',
  '"Save anyway" for two genuinely different purchases that look identical.',
]
