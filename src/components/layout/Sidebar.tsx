import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { NAV_ITEMS } from './navItems'

/**
 * Floating brand/nav toggle, shown at every viewport size (not just desktop)
 * -- fixed positioning means it never scrolls away with page content, and it
 * stays reachable even when the window is narrow/short, alongside BottomNav
 * on small screens. Resting (closed) it's just the app icon (plus the
 * wordmark at sm+) sitting directly on the page -- no colored bubble or
 * pulsing animation behind it, since the icon artwork already carries its
 * own background. Open, it becomes a plain close (X) button.
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
        className={clsx(
          'fixed left-4 top-[calc(1rem+var(--safe-top))] z-40 flex items-center transition-transform hover:scale-105 active:scale-95',
          open
            ? 'h-12 w-12 justify-center rounded-full bg-slate-900/85 text-white shadow-card'
            : 'gap-2'
        )}
      >
        {open ? (
          <X size={18} />
        ) : (
          <>
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-lg" />
            <span className="hidden whitespace-nowrap font-serif text-sm font-semibold text-slate-900 sm:inline">LedgeEaze</span>
          </>
        )}
      </button>

      {open && (
        <nav
          aria-label="Primary"
          className="animate-scale-in fixed left-4 top-[calc(5rem+var(--safe-top))] z-40 flex max-h-[calc(100vh-6rem)] w-60 flex-col gap-1 overflow-y-auto rounded-card border border-app-border bg-app-card p-3 shadow-card"
        >
          <p className="px-2 pb-2 text-sm font-semibold text-slate-900">LedgeEaze</p>
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
