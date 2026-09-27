import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { NAV_GROUPS, type NavGroup } from './navItems'
import { BrandMark } from '@/components/ui/BrandHeader'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import '@/styles/sidebar.css'

/**
 * Two navigations, one per breakpoint band:
 * - lg and up: DesktopSidebar, a persistent labelled rail pinned to the left
 *   edge (brand mark + wordmark, NAV_GROUPS as "Money" / "Plan" / "More"
 *   sections, the signed-in user and Settings at the bottom). AppShell pads
 *   the rest of the page past it.
 * - below lg: FloatingMenu -- the brand mark sits fixed at the top-left and
 *   opens the same grouped nav list as a floating card.
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

/**
 * One labelled section ("Money", "Plan", "More"). The small uppercase label
 * also names the group for screen readers (role="group" + aria-labelledby).
 * `index` staggers the sections' rise-in (sidebar.css).
 */
function NavSection({
  group,
  index,
  rowClassName,
  labelClassName,
}: {
  group: NavGroup
  index: number
  rowClassName: string
  labelClassName: string
}) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="sidebar-section flex flex-col gap-0.5"
      style={{ '--sidebar-i': index } as CSSProperties}
    >
      <p
        id={labelId}
        className={clsx('text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500', labelClassName)}
      >
        {group.label}
      </p>
      {group.items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'sidebar-row flex shrink-0 items-center gap-3 rounded-xl px-3 text-sm',
              rowClassName,
              isActive
                ? 'bg-accent-light font-semibold text-accent-on-light'
                : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )
          }
        >
          <Icon size={18} aria-hidden="true" className="sidebar-row-icon shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </div>
  )
}

function DesktopSidebar() {
  const { displayName, email, avatar } = useAuth()
  const name = displayName || email || '?'

  return (
    // w-60 is mirrored by AppShell's lg:pl-60 content offset -- keep in step.
    // Sized so the whole rail (brand, 11 rows in three sections, the user
    // block, ~680px in all) fits a 1280x800 window without scrolling: 40px
    // rows, 2px gaps, compact section labels. The nav keeps overflow-y-auto
    // only as a fallback for unusually short windows.
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-app-border bg-app-card lg:flex">
      {/* Safe-area rule from CLAUDE.md: pad *below* --safe-top, never inside it
          (an iPad home-screen install at lg width still has a status bar). */}
      <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-[calc(1.25rem+var(--safe-top))]">
        <BrandMark size="md" className="h-10 w-10" />
        <span className="font-serif text-[22px] font-semibold leading-tight text-slate-900">
          Ledge<span className="text-accent-dark">Eaze</span>
        </span>
      </div>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-3">
        {NAV_GROUPS.map((group, i) => (
          <NavSection
            key={group.label}
            group={group}
            index={i}
            rowClassName="min-h-10"
            labelClassName={clsx('px-3 pb-0.5', i === 0 ? 'pt-1.5' : 'pt-2')}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-app-border p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'sidebar-row flex min-h-[44px] items-center gap-2.5 rounded-xl p-2.5',
              isActive ? 'bg-accent-light' : 'bg-slate-50 hover:bg-slate-100'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Avatar avatar={avatar} name={name} size={34} />
              <span className="flex min-w-0 flex-col">
                <span
                  className={clsx(
                    'truncate text-[13px] font-bold',
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
 * Open, it becomes a plain close (X) button and shows the same Money / Plan /
 * More sections as the desktop rail (44px rows here -- touch targets).
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
          'press fixed left-4 top-[calc(1rem+var(--safe-top))] z-40 flex items-center [@media(hover:hover)]:hover:scale-105',
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
          className="animate-scale-in fixed left-4 top-[calc(5rem+var(--safe-top))] z-40 flex max-h-[calc(100dvh-6rem-var(--safe-top))] w-60 flex-col gap-2 overflow-y-auto rounded-card border border-app-border bg-app-card p-3 shadow-card"
        >
          <p className="px-2 text-sm font-semibold text-slate-900">
            Ledge<span className="text-accent-dark">Eaze</span>
          </p>
          {NAV_GROUPS.map((group, i) => (
            <NavSection
              key={group.label}
              group={group}
              index={i}
              rowClassName="min-h-[44px]"
              labelClassName="px-3 pb-0.5 pt-1"
            />
          ))}
        </nav>
      )}
    </div>
  )
}
