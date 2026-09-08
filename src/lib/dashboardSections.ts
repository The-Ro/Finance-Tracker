export type DashboardSectionId =
  | 'summary'
  | 'cashflow'
  | 'categoryChart'
  | 'accountChart'
  | 'activity'
  | 'review'

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionId[] = [
  'summary',
  'cashflow',
  'categoryChart',
  'accountChart',
  'activity',
  'review',
]

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  summary: 'Summary cards',
  cashflow: 'Cash flow chart',
  categoryChart: 'Category breakdown',
  accountChart: 'Account breakdown',
  activity: 'Recent activity',
  review: 'Needs-review banner',
}

function isDashboardSectionId(id: string): id is DashboardSectionId {
  return (DEFAULT_DASHBOARD_ORDER as string[]).includes(id)
}

/**
 * A stored order can be stale (a section shipped after the user's row was
 * created, or the array was hand-edited) -- keep whatever valid ids it has,
 * in that order, then append any missing ones in their default position
 * rather than silently dropping a whole section from the page.
 */
export function normalizeDashboardOrder(stored: string[] | null | undefined): DashboardSectionId[] {
  const valid = (stored ?? []).filter(isDashboardSectionId)
  const missing = DEFAULT_DASHBOARD_ORDER.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}

// The cards inside the "Summary cards" section are separately reorderable
// among themselves (nested under that one row in Customize), distinct from
// the section-level order above. accountBalances lives here (not as its own
// top-level section) since it's the same "small at-a-glance stat" family as
// the other four.
export type SummaryCardId = 'netWorth' | 'income' | 'spending' | 'savingsRate' | 'accountBalances'

export const DEFAULT_SUMMARY_CARD_ORDER: SummaryCardId[] = [
  'netWorth',
  'income',
  'spending',
  'savingsRate',
  'accountBalances',
]

export const SUMMARY_CARD_LABELS: Record<SummaryCardId, string> = {
  netWorth: 'Net worth',
  income: 'Income',
  spending: 'Spending',
  savingsRate: 'Savings rate',
  accountBalances: 'Account balances',
}

function isSummaryCardId(id: string): id is SummaryCardId {
  return (DEFAULT_SUMMARY_CARD_ORDER as string[]).includes(id)
}

export function normalizeSummaryCardOrder(stored: string[] | null | undefined): SummaryCardId[] {
  const valid = (stored ?? []).filter(isSummaryCardId)
  const missing = DEFAULT_SUMMARY_CARD_ORDER.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}
