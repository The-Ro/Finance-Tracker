import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { NAV_ITEMS } from './navItems'

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-app-border bg-white/95 backdrop-blur scrollbar-none md:hidden"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex min-w-[76px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium',
              isActive ? 'text-accent' : 'text-slate-500'
            )
          }
        >
          <Icon size={20} />
          <span className="whitespace-nowrap">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
