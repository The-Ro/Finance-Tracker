import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  HandCoins,
  MessageSquare,
  PiggyBank,
  Split,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
  X,
  type LucideIcon,
  Cake,
  Megaphone,
} from 'lucide-react'
import { useNotifications, type NotificationRow } from '@/hooks/useNotifications'
import { useApproveAccessRequest, useOwnedAccessRows, useRemoveAccessRow, useRequestedAccessRows, useSendAccessRequest } from '@/hooks/useSharing'
import { useMarkFeedbackReplySeen } from '@/hooks/useFeedback'
import { useProfiles } from '@/hooks/useProfiles'
import { useIsAdmin } from '@/lib/admin'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useSalaryConfirm } from '@/hooks/useSalaryConfirm'
import { useOverdueRecurringItems, useRecurringMutations } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useToast } from '@/context/ToastContext'
import { filterNotifications, timeAgo, type NotificationTab } from '@/lib/notifications'
import type { NotificationKind } from '@/types/database.types'
import { AdminFeedbackInbox } from '@/components/settings/AdminFeedbackInbox'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  access_request: UserPlus,
  access_approved: UserCheck,
  access_declined: UserX,
  feedback_reply: MessageSquare,
  split_added: Split,
  split_settled: HandCoins,
  budget: PiggyBank,
  bill_overdue: CalendarClock,
  reminder: BellRing,
  salary: Wallet,
  birthday: Cake,
  announcement: Megaphone,
}
const WARNING_KINDS = new Set<NotificationKind>(['bill_overdue', 'budget'])

const TABS: { id: NotificationTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
]

/**
 * The bell's panel: the full history (src/hooks/useNotifications.ts) in
 * All / Unread / Read tabs. Tapping a note marks it read and opens its page;
 * an access request keeps its Approve / Decline buttons until answered, then
 * stays in the list showing what happened.
 */
export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { visible, isLoading, unreadCount, markRead, markAllRead, remove } = useNotifications()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const markFeedbackSeen = useMarkFeedbackReplySeen()
  const [tab, setTab] = useState<NotificationTab>(unreadCount > 0 ? 'unread' : 'all')

  const list = useMemo(() => filterNotifications(visible, tab), [visible, tab])
  const counts = { all: visible.length, unread: unreadCount, read: visible.length - unreadCount }

  const open = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate([n.id])
    if (n.kind === 'feedback_reply') {
      const feedbackId = n.ref.split(':')[1]
      if (feedbackId) markFeedbackSeen.mutate(feedbackId)
    }
    if (n.url) {
      navigate(n.url)
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      // Phones: pinned to the screen edges (16px), so nothing can push it sideways;
      // sm+: anchored under the bell. overflow-x-hidden: a long name can't make it scroll sideways.
      className="animate-scale-in fixed inset-x-3 top-[calc(76px+var(--safe-top))] z-30 flex max-h-[min(78dvh,640px)] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-card-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[400px]"
    >
      <div className="flex items-center gap-2 border-b border-app-border px-4 pb-2 pt-3">
        <h2 className="mr-auto text-sm font-semibold text-slate-900">Notifications</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="min-h-[36px] rounded-full px-2.5 text-helper font-semibold text-accent-dark hover:bg-accent-light"
          >
            Mark all read
          </button>
        )}
        <button
          type="button"
          aria-label="Close notifications"
          onClick={onClose}
          className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X size={17} />
        </button>
      </div>

      <div role="tablist" aria-label="Show" className="grid grid-cols-3 gap-1 border-b border-app-border px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex min-h-[36px] items-center justify-center gap-1.5 rounded-full text-helper font-semibold transition-colors',
              tab === t.id ? 'bg-accent-light text-accent-on-light' : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span
                className={clsx(
                  'min-w-[20px] rounded-full px-1.5 text-xs leading-5 tabular-nums',
                  t.id === 'unread' ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'
                )}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {isAdmin && tab !== 'read' && (
          <div className="border-b border-app-border p-3 empty:hidden">
            <AdminFeedbackInbox />
          </div>
        )}
        {isLoading ? (
          <p className="p-6 text-center text-helper text-slate-500">Loading…</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Bell size={22} className="text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">
              {tab === 'unread' ? 'You’re all caught up' : tab === 'read' ? 'Nothing read yet' : 'No notifications yet'}
            </p>
            <p className="text-helper text-slate-400">Requests, replies, budget and bill alerts show up here.</p>
          </div>
        ) : (
          <ul className="stagger-rows-soft divide-y divide-app-border">
            {list.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={() => open(n)} onClear={() => remove.mutate(n.id)} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-app-border px-4 py-2.5 text-helper font-medium">
        <NavLink to="/settings/reminders" onClick={onClose} className="text-accent-dark hover:underline">
          Phone reminders
        </NavLink>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <NavLink to="/settings/sharing" onClick={onClose} className="text-accent-dark hover:underline">
          Sharing
        </NavLink>
      </div>
    </div>
  )
}

function NotificationItem({ n, onOpen, onClear }: { n: NotificationRow; onOpen: () => void; onClear: () => void }) {
  const Icon = KIND_ICON[n.kind] ?? Bell
  const unread = !n.read_at
  const confirm = useQuickConfirm(n)
  return (
    <li className={clsx('relative', unread && 'bg-accent-light/40')}>
      <button
        type="button"
        onClick={onOpen}
        className={clsx('flex w-full min-w-0 items-start gap-3 py-3 pl-4 text-left', confirm ? 'pr-20' : 'pr-11')}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            WARNING_KINDS.has(n.kind) ? 'bg-caution-light text-caution' : 'bg-accent-light text-accent-on-light'
          )}
        >
          <Icon size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-start gap-2">
            <span className={clsx('min-w-0 flex-1 text-sm leading-snug text-slate-900', unread ? 'font-semibold' : 'font-medium')}>
              {n.title}
            </span>
            {unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
          </span>
          {n.body && <span className="line-clamp-3 whitespace-pre-line text-helper text-slate-500">{n.body}</span>}
          <span className="text-xs text-slate-400">{timeAgo(n.created_at)}</span>
        </span>
      </button>
      {/* Small tick: do the thing right here (salary arrived / bill paid). */}
      {confirm && (
        <button
          type="button"
          onClick={confirm.run}
          disabled={confirm.busy}
          aria-label={confirm.label}
          title={confirm.label}
          className="absolute right-11 top-2 flex h-9 w-9 items-center justify-center rounded-full text-positive hover:bg-positive-light disabled:opacity-50"
        >
          <Check size={17} strokeWidth={2.5} />
        </button>
      )}
      {/* Clears just this one (hides it from the history). */}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear "${n.title}"`}
        className="absolute right-1.5 top-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={15} />
      </button>
      {n.kind === 'access_request' && <AccessRequestActions n={n} />}
    </li>
  )
}

/** Approve / Decline (and Follow back) under a request; once answered, just what happened. */
function AccessRequestActions({ n }: { n: NotificationRow }) {
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const profiles = useProfiles()
  const approve = useApproveAccessRequest()
  const remove = useRemoveAccessRow()
  const follow = useSendAccessRequest()

  const rowId = n.ref.startsWith('access:') ? n.ref.slice('access:'.length) : null
  const row = (owned.data ?? []).find((r) => r.id === rowId)
  const requester = n.actor_user_id
  const email = requester ? profiles.data?.[requester]?.email : undefined
  const following = !!requester && (requested.data ?? []).some((r) => r.owner_user_id === requester)
  const outcome = n.status ?? (row?.status === 'approved' ? 'approved' : !row && owned.data ? 'gone' : null)

  const followBack =
    requester && email && !following ? (
      <button
        type="button"
        onClick={() => follow.mutate(email)}
        disabled={follow.isPending}
        className="inline-flex min-h-[36px] items-center gap-1 text-helper font-semibold text-accent-dark"
      >
        <UserPlus size={14} aria-hidden="true" /> Ask to see theirs too
      </button>
    ) : following ? (
      <span className="text-helper text-slate-500">You asked to see theirs</span>
    ) : null

  if (outcome) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 pl-16">
        <span className={clsx('text-helper font-semibold', outcome === 'approved' ? 'text-positive' : 'text-slate-500')}>
          {outcome === 'approved' ? 'Approved' : outcome === 'declined' ? 'Declined' : 'No longer pending'}
        </span>
        {followBack}
      </div>
    )
  }
  if (!rowId || !row) return null
  return (
    <div className="flex flex-col gap-1.5 px-4 pb-3 pl-16">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => approve.mutate(row.id)}
          disabled={approve.isPending || remove.isPending}
          className="press inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
        >
          <Check size={15} aria-hidden="true" /> Approve
        </button>
        <button
          type="button"
          onClick={() => remove.mutate(row.id)}
          disabled={approve.isPending || remove.isPending}
          className="press inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-app-border text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          <X size={15} aria-hidden="true" /> Decline
        </button>
      </div>
      {followBack}
    </div>
  )
}

/**
 * The ✓ on a note that can be settled right here: pay day ("yes, it arrived"
 * -- logs the salary exactly like Home's card) or an overdue bill ("paid" --
 * the same Mark paid as Bills). Only while it's still open; null otherwise.
 */
function useQuickConfirm(n: NotificationRow): { label: string; busy: boolean; run: () => void } | null {
  const settings = useUserSettings()
  const confirmSalary = useSalaryConfirm()
  const overdue = useOverdueRecurringItems()
  const { markPaid } = useRecurringMutations()
  const { markRead } = useNotifications()
  const { format } = useFormatCurrency()
  const { show } = useToast()

  if (n.kind === 'salary') {
    const salary = settings.data?.salary
    const month = n.ref.slice('salary:'.length)
    if (!salary || salary.confirmedMonth === month) return null
    return {
      label: `Yes, ${format(salary.amount)} arrived`,
      busy: confirmSalary.isPending,
      run: () =>
        confirmSalary.mutate(
          { amount: salary.amount, month },
          {
            onSuccess: (r) => {
              markRead.mutate([n.id])
              show(`Logged ${format(r.amount)} salary in ${r.account}.`)
            },
            onError: (e) => show(e instanceof Error ? e.message : 'Could not log the salary.', { tone: 'error' }),
          }
        ),
    }
  }

  if (n.kind === 'bill_overdue') {
    const [, id, dueDate] = n.ref.split(':')
    const item = overdue.find((i) => i.id === id && i.next_date === dueDate)
    if (!item || !item.account) return null
    return {
      label: `Mark ${item.name} paid`,
      busy: markPaid.isPending,
      run: () =>
        markPaid.mutate(item, {
          onSuccess: () => {
            markRead.mutate([n.id])
            show(`${item.name} marked paid. ${format(item.amount)} logged from ${item.account}.`)
          },
          onError: (e) => show(e instanceof Error ? e.message : 'Could not mark it paid.', { tone: 'error' }),
        }),
    }
  }
  return null
}
