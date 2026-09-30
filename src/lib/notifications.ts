// The bell's notification history: tab filtering, relative times, and the
// wording of the alerts the app files itself (budget, overdue bill). Pure, so
// it's unit-tested (notifications.test.ts).

export type NotificationTab = 'all' | 'unread' | 'read'

export interface NotificationLike {
  read_at: string | null
  created_at: string
}

export function filterNotifications<T extends NotificationLike>(list: readonly T[], tab: NotificationTab): T[] {
  if (tab === 'unread') return list.filter((n) => !n.read_at)
  if (tab === 'read') return list.filter((n) => !!n.read_at)
  return [...list]
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Sep 12", or "Sep 12, 2025" for another year. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const mins = Math.floor((now.getTime() - then.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (then.getTime() >= startOfToday) return `${Math.floor(mins / 60)} h ago`
  if (then.getTime() >= startOfToday - 86_400_000) return 'Yesterday'
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

export interface OwnAlert {
  ref: string
  kind: 'budget' | 'bill_overdue' | 'salary'
  title: string
  body: string
  url: string
}

/** A budget at 90%+ or over, once per budget per month per level. */
export function budgetNotice(
  a: { budgetId: string; category: string; spent: number; limit: number; status: 'over' | 'approaching' },
  monthKey: string,
  format: (n: number) => string
): OwnAlert {
  const over = a.status === 'over'
  return {
    ref: `budget:${a.budgetId}:${monthKey}:${a.status}`,
    kind: 'budget',
    title: over ? `${a.category} is over budget` : `${a.category} is almost at its budget`,
    body: over
      ? `You've spent ${format(a.spent)} of ${format(a.limit)} this month.`
      : `${format(a.spent)} of ${format(a.limit)} spent. ${format(Math.max(0, a.limit - a.spent))} left this month.`,
    url: '/budgets',
  }
}

/** A recurring payment past its date, once per due date. */
export function overdueNotice(
  item: { id: string; name: string; amount: number; next_date: string },
  format: (n: number) => string,
  formatDate: (iso: string) => string
): OwnAlert {
  return {
    ref: `overdue:${item.id}:${item.next_date}`,
    kind: 'bill_overdue',
    title: `${item.name} is overdue`,
    body: `${format(item.amount)} was due ${formatDate(item.next_date)}. Mark it paid on Bills once it's done.`,
    url: '/bills',
  }
}

/** Pay day: once per month, until the salary is confirmed. */
export function salaryNotice(month: string, amount: number, account: string, format: (n: number) => string): OwnAlert {
  return {
    ref: `salary:${month}`,
    kind: 'salary',
    title: 'Did your salary arrive?',
    body: `${format(amount)} was due in ${account}. Tap to confirm it on Home.`,
    url: '/',
  }
}
