import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Upload, Plus, LogOut, ChevronDown, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useOwnedAccessRows } from '@/hooks/useSharing'
import { useBudgetAlerts } from '@/hooks/useBudgets'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { IncomingAccessRequests } from '@/components/settings/IncomingAccessRequests'
import { BudgetAlerts } from '@/components/budgets/BudgetAlerts'

export function TopBar() {
  const { displayName, email, avatar, signOut } = useAuth()
  const { openAddEntry, openImport } = useGlobalModals()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const owned = useOwnedAccessRows()
  const pendingCount = (owned.data ?? []).filter((r) => r.status === 'pending').length
  const budgetAlerts = useBudgetAlerts()
  const overBudgetCount = budgetAlerts.filter((a) => a.status === 'over').length
  const hasNotifications = pendingCount > 0 || overBudgetCount > 0

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-end border-b border-app-border bg-white/95 px-4 backdrop-blur md:px-8">

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={openImport} className="px-3 sm:px-4">
          <Upload size={16} />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button onClick={openAddEntry} className="px-3 sm:px-4">
          <Plus size={16} />
          <span className="hidden sm:inline">Add entry</span>
        </Button>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            aria-label="Sharing notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-600 hover:bg-slate-50"
          >
            <Bell size={17} />
            {hasNotifications && (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 z-30 mt-2 flex max-h-[80vh] w-80 flex-col gap-3 overflow-y-auto rounded-lg border border-app-border bg-white p-3 shadow-card sm:w-96"
              onMouseLeave={() => setNotifOpen(false)}
            >
              <BudgetAlerts />
              <IncomingAccessRequests />
              <NavLink
                to="/settings"
                onClick={() => setNotifOpen(false)}
                className="block text-center text-helper font-medium text-accent hover:underline"
              >
                Manage sharing in Settings
              </NavLink>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-1.5 rounded-full border border-app-border bg-white px-2 pr-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Avatar avatar={avatar} name={displayName || email || '?'} size={28} />
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-48 rounded-lg border border-app-border bg-white py-1 shadow-card"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-helper text-slate-500">{email}</p>
              </div>
              <NavLink
                role="menuitem"
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium',
                    isActive ? 'bg-accent-light text-accent-dark' : 'text-slate-700 hover:bg-slate-50'
                  )
                }
              >
                <Settings size={15} /> Settings
              </NavLink>
              <button
                role="menuitem"
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
