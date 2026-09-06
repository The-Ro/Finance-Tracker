import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  CreditCard,
  PiggyBank,
  Target,
  FileText,
  SlidersHorizontal,
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
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rules', label: 'Rules', icon: SlidersHorizontal },
]

// Trimmed to 5 for the mobile bottom nav -- Goals, Documents, and Rules stay
// one tap away in the Sidebar menu instead.
export const BOTTOM_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !['/goals', '/documents', '/rules'].includes(item.to)
)
