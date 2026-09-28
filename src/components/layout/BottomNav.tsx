import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { BOTTOM_NAV_ITEMS } from './navItems'
import { useGlobalModals } from '@/context/GlobalModalsContext'

export function BottomNav() {
  const { openAddEntry } = useGlobalModals()
  const tabs = BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs transition-colors',
          isActive ? 'font-bold text-accent-dark' : 'font-medium text-slate-500 hover:text-slate-700'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
          <span className="max-w-full truncate">{label}</span>
        </>
      )}
    </NavLink>
  ))
  const half = Math.ceil(tabs.length / 2)
  return (
    <nav
      aria-label="Primary"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'max(0.25rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.25rem, env(safe-area-inset-right))',
      }}
      className="chrome-surface chrome-surface-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-app-border px-1 md:hidden"
    >
      {tabs.slice(0, half)}
      <div className="flex items-center justify-center">
        <button
          type="button"
          aria-label="Add entry"
          onClick={() => openAddEntry()}
          className="press flex h-14 w-14 -translate-y-2 items-center justify-center rounded-2xl bg-accent text-white shadow-card-lg"
        >
          <Plus size={24} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      {tabs.slice(half)}
    </nav>
  )
}
