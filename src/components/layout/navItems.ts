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
  HandCoins,
  Settings,
  Split,
  type LucideIcon,
} from 'lucide-react'
import { groupNavItems, type NavGroupOf } from '@/lib/navGroups'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Full list -- shown in the Sidebar (grouped via NAV_GROUPS below).
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/bills', label: 'Bills', icon: CalendarDays },
  { to: '/review', label: 'Monthly review', icon: ChartPie },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/shared', label: 'Splits', icon: Split },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/lent', label: 'Lent & borrowed', icon: HandCoins },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rules', label: 'Rules', icon: SlidersHorizontal },
]

export type NavGroup = NavGroupOf<NavItem>

// The same NAV_ITEMS, sectioned for the Sidebar (desktop rail and the
// floating menu below lg): day-to-day money first, then planning, then the
// rest. Any NAV_ITEMS entry not listed here still shows, at the end of
// "More" (see groupNavItems), so adding a page can't silently hide it.
export const NAV_GROUPS: NavGroup[] = groupNavItems(NAV_ITEMS, [
  { label: 'Money', paths: ['/', '/transactions', '/bills', '/review'] },
  { label: 'Plan', paths: ['/budgets', '/goals', '/recurring', '/subscriptions'] },
  { label: 'More', paths: ['/friends', '/shared', '/lent', '/documents', '/rules'] },
])

// Filling the phone menu's last group; the desktop rail's footer (avatar +
// "Settings") and the TopBar profile menu also link here.
export const SETTINGS_NAV_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

// The phone bottom nav: Home, Activity, Review, Bills (plus the centre Add
// button in BottomNav) -- the day-to-day loop. Everything else (Recurring, Subscriptions, Goals, Shared, ...) stays one
// tap away in the Sidebar menu. Short labels here; icons come from NAV_ITEMS.
const BOTTOM_NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Home' },
  { to: '/transactions', label: 'Activity' },
  { to: '/review', label: 'Review' },
  { to: '/bills', label: 'Bills' },
]

export const BOTTOM_NAV_ITEMS: NavItem[] = BOTTOM_NAV.flatMap(({ to, label }) => {
  const item = NAV_ITEMS.find((n) => n.to === to)
  return item ? [{ ...item, label }] : []
})
