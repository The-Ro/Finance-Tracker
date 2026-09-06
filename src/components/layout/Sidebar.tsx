import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { NAV_ITEMS } from './navItems'

/**
 * Floating circular "L" toggle, shown at every viewport size (not just
 * desktop) -- fixed positioning means it never scrolls away with page
 * content, and it stays reachable even when the window is narrow/short,
 * alongside BottomNav on small screens.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef}>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-haspopup="true"
        aria-expanded={open}
        className="fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-base font-bold text-white shadow-card transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={18} /> : 'L'}
      </button>

      {open && (
        <nav
          aria-label="Primary"
          className="animate-scale-in fixed left-4 top-20 z-40 flex w-60 flex-col gap-1 rounded-card border border-app-border bg-app-card p-3 shadow-card"
        >
          <p className="px-2 pb-2 text-sm font-semibold text-slate-900">Ledgerly</p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-light text-accent-dark' : 'text-slate-600 hover:bg-slate-50'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
