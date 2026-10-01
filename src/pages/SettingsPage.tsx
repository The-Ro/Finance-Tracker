import { useEffect } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  LEGACY_SETTINGS_HASHES,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  findSettingsSection,
  sectionsInGroup,
  type SettingsSection,
} from '@/components/settings/settingsSections'

/**
 * Phones: /settings is a grouped list (iOS-style) and each row opens
 * /settings/<section> with a back link. lg and up: a sticky grouped sub-nav
 * beside the selected section; bare /settings shows the first one (Profile).
 */
export function SettingsPage() {
  const { section: sectionId } = useParams()
  const location = useLocation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Section cards fetch their own data, so the page keeps growing as the
    // cards above the target load -- one scroll at mount lands short.
    scroll()
    const retries = [150, 400, 800, 1400, 2200].map((delay) => setTimeout(scroll, delay))
    return () => retries.forEach(clearTimeout)
  }, [location.pathname, location.hash])

  if (!sectionId && location.hash) {
    const target = LEGACY_SETTINGS_HASHES[location.hash.slice(1)]
    if (target) return <Navigate to={`/settings/${target}`} replace />
  }

  const section = findSettingsSection(sectionId)
  if (sectionId && !section) return <Navigate to="/settings" replace />

  if (!isDesktop) {
    if (!section) return <SettingsIndex />
    return (
      <div key={section.id} className="animate-fade-in-up flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <Link
            to="/settings"
            className="-ml-1.5 inline-flex min-h-[44px] w-fit items-center gap-0.5 text-sm font-medium text-accent-dark"
          >
            <ChevronLeft size={20} aria-hidden="true" />
            Settings
          </Link>
          <PageHeader title={section.label} />
          <p className="text-helper text-slate-500">{section.subtitle}</p>
        </div>
        <div className="flex flex-col gap-4">{section.render()}</div>
      </div>
    )
  }

  const active = section ?? SETTINGS_SECTIONS[0]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-[13.5rem_minmax(0,1fr)] items-start gap-8 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <SettingsSubNav activeId={active.id} />
        <div key={active.id} className="animate-fade-in-up flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-slate-900">{active.label}</h2>
            <p className="mt-1 text-helper text-slate-500">{active.subtitle}</p>
          </div>
          {active.render()}
        </div>
      </div>
    </div>
  )
}

function SettingsSubNav({ activeId }: { activeId: string }) {
  return (
    // Sticks just below the sticky TopBar (--bar-h + --safe-top) plus main's pt-5.
    <nav aria-label="Settings" className="sticky top-[calc(var(--bar-h)+1.25rem+var(--safe-top))] flex flex-col gap-4">
      {SETTINGS_GROUPS.map((group) => (
        <div
          key={group.id}
          className={clsx('flex flex-col gap-0.5', group.id === 'danger' && 'border-t border-app-border pt-4')}
        >
          {group.id !== 'danger' && (
            <p className="px-3 pb-1 text-helper font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
          )}
          {sectionsInGroup(group.id).map(({ id, label, icon: Icon }) => {
            const isActive = id === activeId
            const danger = group.id === 'danger'
            return (
              <Link
                key={id}
                to={`/settings/${id}`}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                  isActive && !danger && 'bg-accent-light font-semibold text-accent-on-light',
                  isActive && danger && 'bg-danger-light font-semibold text-danger',
                  !isActive && danger && 'font-medium text-danger hover:bg-danger-light',
                  !isActive && !danger && 'font-medium text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SettingsIndex() {
  const { displayName, email, avatar } = useAuth()
  const name = displayName || email || '?'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" />
      <div className="stagger-rows flex flex-col gap-6">
        <Link
          to="/settings/profile"
          className="card-interactive flex items-center gap-4 rounded-card border border-app-border bg-app-card p-4 shadow-card"
        >
          <Avatar avatar={avatar} name={name} size={56} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-serif text-lg font-semibold text-slate-900">{name}</span>
            {email && email !== name && <span className="truncate text-helper text-slate-500">{email}</span>}
            <span className="mt-0.5 text-helper font-medium text-accent-dark">Profile and personal details</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
        </Link>

        {SETTINGS_GROUPS.map((group) => {
          // The header card above already opens Profile.
          const rows = sectionsInGroup(group.id).filter((s) => s.id !== 'profile')
          const headingId = `settings-group-${group.id}`
          return (
            <section key={group.id} aria-labelledby={group.id === 'danger' ? undefined : headingId}>
              {group.id !== 'danger' && (
                <h2 id={headingId} className="px-1 pb-2 text-helper font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </h2>
              )}
              <Card className="overflow-hidden">
                <ul className="divide-y divide-app-border">
                  {rows.map((s) => (
                    <li key={s.id}>
                      <SettingsRow section={s} danger={group.id === 'danger'} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function SettingsRow({ section, danger }: { section: SettingsSection; danger: boolean }) {
  const Icon = section.icon
  return (
    <Link
      to={`/settings/${section.id}`}
      className="flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          danger ? 'bg-danger-light text-danger' : 'bg-accent-light text-accent-on-light'
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={clsx('text-sm font-semibold', danger ? 'text-danger' : 'text-slate-900')}>{section.label}</span>
        <span className="truncate text-helper text-slate-500">{section.subtitle}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  )
}
