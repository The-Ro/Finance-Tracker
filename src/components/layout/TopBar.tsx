import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Upload, Plus, LogOut, ChevronDown, Settings, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useOwnedAccessRows } from '@/hooks/useSharing'
import { useBudgetAlerts } from '@/hooks/useBudgets'
import { useAdminFeedbackInbox, useMyFeedbackReplies } from '@/hooks/useFeedback'
import { ADMIN_EMAIL } from '@/lib/admin'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { IncomingAccessRequests } from '@/components/settings/IncomingAccessRequests'
import { BudgetAlerts } from '@/components/budgets/BudgetAlerts'
import { AdminFeedbackInbox } from '@/components/settings/AdminFeedbackInbox'
import { FeedbackReplyNotice } from '@/components/settings/FeedbackReplyNotice'

export function TopBar() {
  const { displayName, email, avatar, signOut } = useAuth()
  const { openAddEntry, openImport } = useGlobalModals()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const owned = useOwnedAccessRows()
  const pendingCount = (owned.data ?? []).filter((r) => r.status === 'pending').length
  const budgetAlerts = useBudgetAlerts()
  const overBudgetCount = budgetAlerts.filter((a) => a.status === 'over').length
  const isAdmin = email === ADMIN_EMAIL
  const adminInbox = useAdminFeedbackInbox()
  const unrepliedCount = isAdmin ? (adminInbox.data ?? []).filter((f) => !f.admin_reply).length : 0
  const myReplies = useMyFeedbackReplies()
  const hasNotifications =
    pendingCount > 0 || overBudgetCount > 0 || unrepliedCount > 0 || (myReplies.data ?? []).length > 0

  useEffect(() => {
    if (!notifOpen) return
    function handlePointerDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notifOpen])

  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-end border-b border-app-border bg-white/95 px-4 pt-[var(--safe-top)] backdrop-blur md:px-8">

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={openImport} className="px-3 sm:px-4">
          <Upload size={16} />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button onClick={openAddEntry} className="px-3 sm:px-4">
          <Plus size={16} />
          <span className="hidden sm:inline">Add entry</span>
        </Button>

        <div className="relative" ref={notifRef}>
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
              // Fixed + viewport-relative insets on mobile so a 320px-wide panel anchored
              // to this small button doesn't blow past the left edge of a narrow screen;
              // sm+ has room to anchor it normally under the bell instead.
              className="animate-scale-in fixed inset-x-4 top-[76px] z-30 flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-lg border border-app-border bg-white p-3 shadow-card sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[80vh] sm:w-96"
            >
              {hasNotifications ? (
                <>
                  {isAdmin && <AdminFeedbackInbox />}
                  <FeedbackReplyNotice />
                  <BudgetAlerts />
                  <IncomingAccessRequests />
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Bell size={22} className="text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">You're all caught up</p>
                  <p className="text-helper text-slate-400">No pending requests or budget alerts right now.</p>
                </div>
              )}
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
              {/* Temporary shortcut while the notification-bell reply flow
                  is new -- makes it easy to find the feedback form itself,
                  not just the replies to it. Revisit whether this earns a
                  permanent spot once that flow's been used for a while. */}
              <NavLink
                role="menuitem"
                to="/settings#feedback"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MessageSquare size={15} /> Feedback
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
