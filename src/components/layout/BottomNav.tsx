import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { BOTTOM_NAV_ITEMS } from './navItems'

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-app-border bg-white/95 px-1 backdrop-blur md:hidden"
    >
      {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors',
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
      ))}
    </nav>
  )
}
