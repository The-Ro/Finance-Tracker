import { useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, ChevronDown, Megaphone, Search, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AdminFeedbackInbox } from '@/components/settings/AdminFeedbackInbox'
import { AdminUserActions } from '@/components/admin/AdminUserActions'
import { useAuth } from '@/context/AuthContext'
import { useAdminStatus } from '@/lib/admin'
import {
  isLiveAnnouncement,
  useAdminErrors,
  useAdminOverview,
  useAdminAuditLog,
  useAdminUsers,
  useAnnouncementMutations,
  useAnnouncements,
} from '@/hooks/useAdmin'
import { useToast } from '@/context/ToastContext'
import { formatShortDate, toLocalISODate } from '@/lib/format'
import type { AnnouncementTone } from '@/types/database.types'

type Tab = 'overview' | 'users' | 'feedback' | 'errors' | 'announcements'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'errors', label: 'Errors' },
  { id: 'announcements', label: 'Announcements' },
]

/** "3h ago" / "2d ago" / a date, for sign-ins and last-seen times. */
function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatShortDate(toLocalISODate(new Date(iso)))
}

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'danger' }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-4">
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-helper">{label}</span>
      <span className={clsx('font-serif text-2xl font-semibold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-slate-900')}>
        {value}
      </span>
      {sub && <span className="truncate text-helper text-slate-500">{sub}</span>}
    </Card>
  )
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'positive' | 'caution' }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
        tone === 'accent' && 'bg-accent-light text-accent-on-light',
        tone === 'positive' && 'bg-positive-light text-positive',
        tone === 'caution' && 'bg-caution-light text-caution',
        tone === 'neutral' && 'bg-slate-100 text-slate-600'
      )}
    >
      {children}
    </span>
  )
}

function OverviewTab() {
  const { data, isLoading } = useAdminOverview()
  if (isLoading || !data) return <Skeleton className="h-48 w-full rounded-card" />
  const weeks = data.signups_by_week
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count))
  return (
    <div className="flex flex-col gap-4">
      <div className="stagger-rows grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={data.users} sub={`${data.signups_30d} joined in 30 days`} />
        <Stat label="New this week" value={data.signups_7d} />
        <Stat label="Active this week" value={data.logging_7d} sub={`${data.signed_in_7d} signed in`} />
        <Stat label="Entries" value={data.transactions.toLocaleString()} sub={`${data.transactions_7d} this week`} />
        <Stat label="Open feedback" value={data.feedback_open} />
        <Stat label="App errors" value={data.errors_7d} sub="Last 7 days" tone={data.errors_7d > 0 ? 'danger' : undefined} />
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Sign-ups per week</h3>
        {weeks.length === 0 ? (
          <p className="text-sm text-slate-500">No sign-ups in the last 12 weeks.</p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.week} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-slate-600">{w.count}</span>
                <div
                  className="animate-bar-rise w-full max-w-[40px] rounded-t-md bg-accent dark:bg-accent-dark"
                  style={{ height: `${Math.max(6, (w.count / maxWeek) * 100)}%` }}
                />
                <span className="text-xs text-slate-500">{formatShortDate(w.week)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-helper text-slate-500">
        Counts only. The dashboard never shows anyone's transactions, balances or budgets.
      </p>
    </div>
  )
}

function UsersTab() {
  const { data = [], isLoading } = useAdminUsers()
  const { userId } = useAuth()
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? data.filter((u) => `${u.display_name ?? ''} ${u.email}`.toLowerCase().includes(q)) : data
  }, [data, query])
  if (isLoading) return <Skeleton className="h-64 w-full rounded-card" />
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-app-border bg-white px-3.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${data.length} users by name or email`}
          aria-label="Search users"
          className="min-h-[44px] min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No users match" description="Try a different name or email." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="stagger-rows divide-y divide-app-border">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-900">{u.display_name || 'No name'}</span>
                    {u.is_admin && <Badge tone="accent">Admin</Badge>}
                    {!u.email_confirmed && <Badge tone="caution">Email not confirmed</Badge>}
                    {u.setup_done ? <Badge tone="positive">Set up</Badge> : <Badge>Not set up</Badge>}
                  </div>
                  <p className="truncate text-helper text-slate-500">{u.email}</p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-3 text-helper sm:w-[22rem]">
                  <div>
                    <dt className="text-slate-500">Joined</dt>
                    <dd className="font-medium text-slate-800">{formatShortDate(toLocalISODate(new Date(u.created_at)))}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Signed in</dt>
                    <dd className="font-medium text-slate-800">{timeAgo(u.last_sign_in_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Entries</dt>
                    <dd className="font-medium tabular-nums text-slate-800">
                      {u.transactions}
                      {u.last_entry_at && <span className="font-normal text-slate-500"> · {timeAgo(u.last_entry_at)}</span>}
                    </dd>
                  </div>
                </dl>
                <div className="sm:basis-full">
                  <AdminUserActions user={u} isSelf={u.id === userId} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <AdminAuditCard />
    </div>
  )
}

const AUDIT_LABELS = {
  grant_admin: 'made an admin',
  revoke_admin: 'removed as admin',
  delete_user: 'deleted',
  reset_password: 'sent a password reset',
} as const

/** The last admin actions: who did what to whom. */
function AdminAuditCard() {
  const { data = [] } = useAdminAuditLog()
  if (data.length === 0) return null
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-sm font-semibold text-slate-800">Recent admin actions</h3>
      <ul className="flex flex-col divide-y divide-app-border">
        {data.map((a, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-helper">
            <span className="min-w-0 text-slate-700">
              <b className="font-semibold">{a.target_email ?? 'A user'}</b> {AUDIT_LABELS[a.action]}
              <span className="text-slate-500"> by {a.admin_email ?? 'an admin'}</span>
            </span>
            <span className="shrink-0 text-slate-500">{timeAgo(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function FeedbackTab() {
  const [filter, setFilter] = useState<'open' | 'replied' | 'all'>('open')
  const labels = { open: 'Waiting for a reply', replied: 'Replied', all: 'All' } as const
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Which feedback">
        {(['open', 'replied', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              'min-h-[40px] rounded-full border px-4 text-sm font-semibold transition-colors',
              filter === f ? 'border-accent bg-accent text-white' : 'border-app-border bg-app-card text-slate-600 hover:bg-slate-50'
            )}
          >
            {labels[f]}
          </button>
        ))}
      </div>
      <Card className="p-4">
        <AdminFeedbackInbox filter={filter} emptyText={filter === 'open' ? 'Nothing waiting for a reply.' : 'No feedback here.'} />
      </Card>
    </div>
  )
}

const ERROR_WINDOWS = [7, 30, 90] as const

function ErrorsTab() {
  const [days, setDays] = useState<(typeof ERROR_WINDOWS)[number]>(7)
  const { data = [], isLoading } = useAdminErrors(days)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Crashes the app reported, grouped by message.</p>
        <Dropdown
          compact
          aria-label="How far back"
          options={ERROR_WINDOWS.map((d) => `Last ${d} days`)}
          value={`Last ${days} days`}
          onChange={(e) => {
            const d = ERROR_WINDOWS.find((w) => `Last ${w} days` === e.target.value)
            if (d) setDays(d)
          }}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : data.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No errors" description={`Nothing reported in the last ${days} days.`} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="stagger-rows divide-y divide-app-border">
            {data.map((e) => {
              const expanded = open === e.message
              return (
                <li key={e.message}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : e.message)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">{e.message}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-helper text-slate-500">
                        <span>
                          {e.occurrences}× · {e.people} {e.people === 1 ? 'person' : 'people'} · last {timeAgo(e.last_seen)}
                        </span>
                        {e.versions.map((v) => (
                          <Badge key={v}>v{v}</Badge>
                        ))}
                      </div>
                    </div>
                    <ChevronDown size={16} className={clsx('mt-0.5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                  </button>
                  {expanded && (
                    <div className="animate-fade-in flex flex-col gap-2 px-4 pb-4">
                      {e.sample_url && (
                        <p className="break-all text-helper text-slate-600">
                          <span className="font-semibold">Page:</span> {e.sample_url}
                        </p>
                      )}
                      <p className="text-helper text-slate-500">First seen {timeAgo(e.first_seen)}</p>
                      {e.sample_stack && (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                          {e.sample_stack}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

const TONES: { id: AnnouncementTone; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'success', label: 'Good news' },
  { id: 'warning', label: 'Heads up' },
]
const MAX_ANNOUNCEMENT = 280

function AnnouncementsTab() {
  const { data = [], isLoading } = useAnnouncements()
  const { create, setActive, remove } = useAnnouncementMutations()
  const { show } = useToast()
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<AnnouncementTone>('info')
  const [endsOn, setEndsOn] = useState('')

  const post = () => {
    // An end date means "until the end of that day" in the admin's timezone.
    const endsAt = endsOn ? new Date(`${endsOn}T23:59:59`).toISOString() : null
    create.mutate(
      { message, tone, endsAt },
      {
        onSuccess: () => {
          setMessage('')
          setEndsOn('')
          show('Announcement posted.')
        },
        onError: () => show('Could not post the announcement.', { tone: 'error' }),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-slate-800">New announcement</h3>
        <p className="text-helper text-slate-500">
          Shows as a banner at the top of the app for everyone who's signed in, until you switch it off or it ends.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_ANNOUNCEMENT))}
          rows={3}
          placeholder="e.g. New: loan details on recurring payments. Add yours from Recurring."
          aria-label="Announcement message"
          className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-helper font-medium text-slate-600">Style</span>
            <div className="flex gap-1.5" role="group" aria-label="Announcement style">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tone === t.id}
                  onClick={() => setTone(t.id)}
                  className={clsx(
                    'min-h-[40px] rounded-full border px-3 text-sm font-medium',
                    tone === t.id ? 'border-accent bg-accent-light text-accent-on-light' : 'border-app-border text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-helper font-medium text-slate-600">Ends (optional)</span>
            <input
              type="date"
              value={endsOn}
              min={toLocalISODate(new Date())}
              onChange={(e) => setEndsOn(e.target.value)}
              className="min-h-[40px] rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <span className="ml-auto text-helper tabular-nums text-slate-500">
            {message.length}/{MAX_ANNOUNCEMENT}
          </span>
          <Button onClick={post} disabled={!message.trim() || create.isPending}>
            <Megaphone size={15} aria-hidden="true" />
            {create.isPending ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-card" />
      ) : data.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Anything you post shows up here." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="stagger-rows divide-y divide-app-border">
            {data.map((a) => {
              const live = isLiveAnnouncement(a)
              return (
                <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{a.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-helper text-slate-500">
                      {live ? <Badge tone="positive">Live</Badge> : <Badge>Off</Badge>}
                      <Badge>{TONES.find((t) => t.id === a.tone)?.label ?? a.tone}</Badge>
                      <span>
                        Posted {timeAgo(a.created_at)}
                        {a.ends_at ? ` · ends ${formatShortDate(toLocalISODate(new Date(a.ends_at)))}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setActive.mutate({ id: a.id, active: !a.active })}
                      disabled={setActive.isPending}
                    >
                      {a.active ? 'Switch off' : 'Switch on'}
                    </Button>
                    <button
                      type="button"
                      aria-label="Delete announcement"
                      onClick={() => remove.mutate(a.id)}
                      disabled={remove.isPending}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-danger-light hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

/**
 * /admin -- for admins only (is_admin(); the admin_* functions and RLS refuse
 * everyone else server-side, this redirect just keeps others off the page).
 */
export function AdminPage() {
  const { isAdmin, loading } = useAdminStatus()
  const [tab, setTab] = useState<Tab>('overview')
  if (loading) return <Skeleton className="h-64 w-full rounded-card" />
  if (!isAdmin) return <Navigate to="/" replace />
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Admin" />
      <div role="tablist" aria-label="Admin sections" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in-up">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'errors' && <ErrorsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
      </div>
    </div>
  )
}
