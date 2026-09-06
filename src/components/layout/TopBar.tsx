import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Upload, Plus, LogOut, ChevronDown, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

export function TopBar() {
  const { displayName, email, avatar, signOut } = useAuth()
  const { openAddEntry, openImport } = useGlobalModals()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-app-border bg-white/95 px-4 backdrop-blur md:px-8">
      <div className="ml-14 text-base font-semibold text-slate-900">Ledgerly</div>

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
