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
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rules', label: 'Rules', icon: SlidersHorizontal },
]
