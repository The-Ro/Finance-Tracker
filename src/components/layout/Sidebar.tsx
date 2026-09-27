import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { NAV_ITEMS } from './navItems'
import { BrandMark } from '@/components/ui/BrandHeader'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'

/**
 * Two navigations, one per breakpoint band:
 * - lg and up: DesktopSidebar, a persistent labelled rail pinned to the left
 *   edge (brand mark + wordmark, every NAV_ITEMS entry, the signed-in user
 *   and Settings at the bottom). AppShell pads the rest of the page past it.
 * - below lg: FloatingMenu, unchanged -- the brand mark sits fixed at the
 *   top-left and opens the full nav list as a floating card.
 */
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <div className="lg:hidden">
        <FloatingMenu />
      </div>
    </>
  )
}

function DesktopSidebar() {
  const { displayName, email, avatar } = useAuth()
  const name = displayName || email || '?'

  return (
    // w-64 is mirrored by AppShell's lg:pl-64 content offset -- keep in step.
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-app-border bg-app-card lg:flex">
      {/* Safe-area rule from CLAUDE.md: pad *below* --safe-top, never inside it
          (an iPad home-screen install at lg width still has a status bar). */}
      <div className="flex items-center gap-3 px-6 pb-5 pt-[calc(1.75rem+var(--safe-top))]">
        <BrandMark size="md" className="h-11 w-11" />
        <span className="font-serif text-2xl font-semibold leading-tight text-slate-900">
          Ledge<span className="text-accent-dark">Eaze</span>
        </span>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                isActive
                  ? 'bg-accent-light font-semibold text-accent-on-light'
                  : 'font-medium text-slate-600 hover:bg-slate-50'
              )
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-app-border p-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex min-h-[44px] items-center gap-3 rounded-xl p-3 transition-colors',
              isActive ? 'bg-accent-light' : 'bg-slate-50 hover:bg-slate-100'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Avatar avatar={avatar} name={name} size={36} />
              <span className="flex min-w-0 flex-col">
                <span
                  className={clsx(
                    'truncate text-sm font-semibold',
                    isActive ? 'text-accent-on-light' : 'text-slate-900'
                  )}
                >
                  {name}
                </span>
                <span className={clsx('text-helper', isActive ? 'text-accent-on-light' : 'text-slate-500')}>
                  Settings
                </span>
              </span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

/**
 * Floating brand/nav toggle for phones and tablets (below lg) -- fixed
 * positioning means it never scrolls away with page content, and it stays
 * reachable even when the window is narrow/short, alongside BottomNav on
 * small screens. Resting (closed) it's the same BrandMark used on the auth
 * pages (plus the wordmark at sm+) sitting directly on the page, at the same
 * size as on login -- no colored bubble or pulsing animation behind it.
 * Open, it becomes a plain close (X) button.
 */
function FloatingMenu() {
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
          'press fixed left-4 top-[calc(1rem+var(--safe-top))] z-40 flex items-center hover:scale-105',
          open
            ? 'h-12 w-12 justify-center rounded-full bg-slate-900/85 text-white shadow-card'
            : 'min-h-[44px] gap-2'
        )}
      >
        {open ? (
          <X size={18} />
        ) : (
          <>
            {/* 36px, so the flourish-less small artwork. */}
            <BrandMark size="sm" />
            <span className="hidden whitespace-nowrap font-serif text-sm font-semibold text-slate-900 sm:inline">
              Ledge<span className="text-accent-dark">Eaze</span>
            </span>
          </>
        )}
      </button>

      {open && (
        <nav
          aria-label="Primary"
          className="animate-scale-in fixed left-4 top-[calc(5rem+var(--safe-top))] z-40 flex max-h-[calc(100vh-6rem)] w-60 flex-col gap-1 overflow-y-auto rounded-card border border-app-border bg-app-card p-3 shadow-card"
        >
          <p className="px-2 pb-2 text-sm font-semibold text-slate-900">
            Ledge<span className="text-accent-dark">Eaze</span>
          </p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-light text-accent-on-light' : 'text-slate-600 hover:bg-slate-50'
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
