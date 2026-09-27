import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  CreditCard,
  PiggyBank,
  Target,
  FileText,
  SlidersHorizontal,
  CalendarDays,
  ChartPie,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Settings lives only in the profile menu (TopBar), not in the main nav.
// Full list -- shown in the Sidebar's expanded menu.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/bills', label: 'Bills', icon: CalendarDays },
  { to: '/review', label: 'Monthly review', icon: ChartPie },
  { to: '/shared', label: 'Shared', icon: Users },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rules', label: 'Rules', icon: SlidersHorizontal },
]

// The phone bottom nav: Home, Activity, Bills, Review, Budgets -- the day-to-day
// loop. Everything else (Recurring, Subscriptions, Goals, Shared, ...) stays one
// tap away in the Sidebar menu. Short labels here; icons come from NAV_ITEMS.
const BOTTOM_NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Home' },
  { to: '/transactions', label: 'Activity' },
  { to: '/bills', label: 'Bills' },
  { to: '/review', label: 'Review' },
  { to: '/budgets', label: 'Budgets' },
]

export const BOTTOM_NAV_ITEMS: NavItem[] = BOTTOM_NAV.flatMap(({ to, label }) => {
  const item = NAV_ITEMS.find((n) => n.to === to)
  return item ? [{ ...item, label }] : []
})
