export type DashboardSectionId = 'summary' | 'cashflow' | 'breakdown' | 'activity' | 'review'

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionId[] = ['summary', 'cashflow', 'breakdown', 'activity', 'review']

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  summary: 'Summary cards',
  cashflow: 'Cash flow chart',
  breakdown: 'Category & account breakdown',
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
