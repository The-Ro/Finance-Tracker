import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Download, FileUp, Plus, LogOut, ChevronDown, Settings, MessageSquare, ShieldCheck } from 'lucide-react'
import { openInstallHelp, usePwaInstall } from '@/hooks/usePwaInstall'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useAdminFeedbackInbox } from '@/hooks/useFeedback'
import { useFileOwnAlerts, useNotifications } from '@/hooks/useNotifications'
import { useIsAdmin } from '@/lib/admin'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationsPanel } from './NotificationsPanel'

export function TopBar() {
  const { displayName, email, avatar, signOut } = useAuth()
  const { openAddEntry, openImport } = useGlobalModals()
  const [menuOpen, setMenuOpen] = useState(false)
  const pwa = usePwaInstall()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const isAdmin = useIsAdmin()
  const adminInbox = useAdminFeedbackInbox()
  const unrepliedCount = isAdmin ? (adminInbox.data ?? []).filter((f) => !f.admin_reply).length : 0
  // The bell's history (NotificationsPanel); the app files its own budget and
  // overdue-bill alerts into it here, once each.
  const notifications = useNotifications()
  const refreshNotifications = notifications.invalidate
  const onFiled = useCallback(() => {
    refreshNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useFileOwnAlerts(notifications.data, onFiled)
  const hasNotifications = notifications.unreadCount > 0 || unrepliedCount > 0

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
    <header className="chrome-surface sticky top-0 z-20 flex min-h-[calc(76px+var(--safe-top))] items-center justify-end border-b border-app-border px-4 pt-[var(--safe-top)] md:px-8">

      <div className="flex items-center gap-2">
        {/* Phones: one family of 44px circles (import, bell, avatar); sm+: labelled pills. */}
        <button
          type="button"
          onClick={openImport}
          aria-label="Import transactions from CSV"
          className="press flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-app-border bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto sm:px-4"
        >
          <FileUp size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Import</span>
        </button>
        <Button onClick={() => openAddEntry()} className="hidden h-11 rounded-full px-4 md:inline-flex">
          <Plus size={16} />
          <span>Add entry</span>
        </Button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            aria-label={notifications.unreadCount > 0 ? `Notifications, ${notifications.unreadCount} unread` : 'Notifications'}
            className="press relative flex h-11 w-11 items-center justify-center rounded-full border border-app-border bg-white text-slate-600 hover:bg-slate-50"
          >
            <Bell size={18} aria-hidden="true" />
            {hasNotifications && (
              <span className="absolute right-2 top-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            )}
          </button>
          {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="press flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-app-border bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto sm:justify-start sm:pl-1.5 sm:pr-3"
          >
            <Avatar avatar={avatar} name={displayName || email || '?'} size={32} />
            <ChevronDown size={14} className="hidden sm:block" aria-hidden="true" />
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
                    isActive ? 'bg-accent-light text-accent-on-light' : 'text-slate-700 hover:bg-slate-50'
                  )
                }
              >
                <Settings size={15} /> Settings
              </NavLink>
              {isAdmin && (
                <NavLink
                  role="menuitem"
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium',
                      isActive ? 'bg-accent-light text-accent-on-light' : 'text-slate-700 hover:bg-slate-50'
                    )
                  }
                >
                  <ShieldCheck size={15} /> Admin
                </NavLink>
              )}
              {/* Temporary shortcut while the notification-bell reply flow
                  is new -- makes it easy to find the feedback form itself,
                  not just the replies to it. Revisit whether this earns a
                  permanent spot once that flow's been used for a while. */}
              <NavLink
                role="menuitem"
                to="/settings/feedback"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MessageSquare size={15} /> Feedback
              </NavLink>
              {!pwa.isStandalone && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    openInstallHelp()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download size={15} /> Install app
                </button>
              )}
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
