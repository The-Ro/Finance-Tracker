import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Cake, ChevronRight, Clock, Search, Send, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { FieldError, FormError } from '@/components/ui/FieldError'
import { BrandMark } from '@/components/ui/BrandHeader'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useProfiles } from '@/hooks/useProfiles'
import { useSplits } from '@/hooks/useSplits'
import {
  useAddFriend,
  useApproveAccessRequest,
  useOwnedAccessRows,
  useRemoveAccessRow,
  useRemoveFriend,
  useRequestedAccessRows,
  useSendAccessRequest,
  useShareWithFriend,
  useFriendBirthday,
} from '@/hooks/useSharing'
import { buildFriends, sharingWords, type Friend } from '@/lib/friends'
import { splitBalances } from '@/lib/splits'
import { shareText } from '@/lib/share'

interface Person {
  name: string
  first: string
  email: string
  avatar: string | null
  bio: string | null
}

/**
 * Friends: the people you share with (the old Settings -> Sharing). One card
 * per person with what each side sees and the money between you from splits;
 * requests to see yours at the top; add by exact email (sharing yours too, by
 * default); invite someone who isn't on LedgeEaze with a link.
 */
export function FriendsPage() {
  const { userId } = useAuth()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const { data: profiles = {} } = useProfiles()
  const { data: splits = [] } = useSplits()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const approve = useApproveAccessRequest()
  const removeRow = useRemoveAccessRow()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const friends = useMemo(
    () => buildFriends(userId ?? '', owned.data ?? [], requested.data ?? [], splitBalances(splits, userId ?? '')),
    [userId, owned.data, requested.data, splits]
  )
  const person = (id: string): Person => {
    const p = profiles[id]
    const name = p?.displayName || p?.email || 'Someone'
    return { name, first: name.split(' ')[0], email: p?.email ?? '', avatar: p?.avatar ?? null, bio: p?.bio?.trim() || null }
  }
  const asking = friends.filter((f) => f.theySeeMine === 'asking')
  const owedToMe = friends.reduce((sum, f) => sum + Math.max(0, f.net), 0)
  const iOwe = friends.reduce((sum, f) => sum + Math.max(0, -f.net), 0)
  const loading = owned.isLoading || requested.isLoading
  const invite = async () => {
    const result = await shareText('Welcome to LedgeEaze', `Welcome to LedgeEaze! Join me here: ${window.location.origin}`)
    if (result === 'copied') show('Link copied. Paste it in a message.')
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Friends"
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Find a friend"
            title="Find a friend"
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-card hover:bg-accent-dark"
          >
            <Search size={19} strokeWidth={2.3} aria-hidden="true" />
          </button>
        }
      />
      <p className="-mt-3 text-sm text-slate-500">You choose what each side sees.</p>

      {friends.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-0.5 p-3.5">
            <span className="text-xs font-semibold text-slate-500">Friends owe you</span>
            <span className="font-serif text-xl font-semibold tabular-nums text-positive">{format(owedToMe)}</span>
          </Card>
          <Card className="flex flex-col gap-0.5 p-3.5">
            <span className="text-xs font-semibold text-slate-500">You owe</span>
            <span className={clsx('font-serif text-xl font-semibold tabular-nums', iOwe > 0 ? 'text-danger' : 'text-slate-900')}>{format(iOwe)}</span>
          </Card>
        </div>
      )}

      {/* Requests to see your entries come first. */}
      {asking.length > 0 && (
        <Card className="flex flex-col gap-3 border-accent/30 p-3.5">
          <ul className="stagger-rows flex flex-col gap-3">
            {asking.map((f) => {
              const p = person(f.id)
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                  <Avatar avatar={p.avatar} name={p.name} size={44} />
                  <span className="min-w-[150px] flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
                    <span className="block text-helper text-slate-500">wants to see your entries</span>
                  </span>
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      className="press min-h-[40px] shrink-0 rounded-full border border-app-border px-3.5 text-sm font-semibold text-slate-600"
                      disabled={removeRow.isPending}
                      onClick={() => f.incomingId && removeRow.mutate(f.incomingId)}
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      className="press min-h-[40px] shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-white"
                      disabled={approve.isPending}
                      onClick={() => f.incomingId && approve.mutate(f.incomingId)}
                    >
                      Yes
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {loading ? null : friends.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No friends yet"
          description="Add someone by email to see each other's entries and split costs."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setAdding(true)}>
                <Search size={16} aria-hidden="true" /> Find a friend
              </Button>
              <Button variant="secondary" onClick={() => void invite()}>
                <Send size={15} aria-hidden="true" /> Invite
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="stagger-rows flex flex-col divide-y divide-app-border">
            {friends.map((f) => {
              const p = person(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(f.id)}
                    aria-label={`${p.name}: ${sharingWords(f)}`}
                    className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 [@media(hover:hover)]:hover:bg-slate-50"
                  >
                    <Avatar avatar={p.avatar} name={p.name} size={46} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="truncate text-[15px] font-bold text-slate-900">{p.name}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {friendChips(f).map((c) => (
                          <span key={c.label} className={clsx('inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-bold', c.tone)}>
                            {c.label}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      {f.net !== 0 && <span className="text-[11px] font-semibold text-slate-500">{f.net > 0 ? 'owes you' : 'you owe'}</span>}
                      <span className={clsx('font-serif text-base font-semibold tabular-nums', f.net > 0 ? 'text-positive' : f.net < 0 ? 'text-danger' : 'text-slate-500')}>
                        {f.net === 0 ? 'Settled' : format(Math.abs(f.net))}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {friends.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card bg-accent p-4 text-white shadow-card">
          <div className="flex items-center gap-3">
            <BrandMark size="md" className="h-11 w-11 shrink-0" />
            <p className="font-serif text-lg font-semibold leading-snug">Welcome your friends &amp; family to LedgeEaze</p>
          </div>
          <button
            type="button"
            onClick={() => void invite()}
            className="press flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#ffffff] text-sm font-bold text-[rgb(var(--accent))]"
          >
            <Send size={16} aria-hidden="true" /> Send a link
          </button>
        </section>
      )}

      <AddFriendSheet open={adding} onClose={() => setAdding(false)} onInvite={() => void invite()} />
      <FriendSheet
        friend={friends.find((f) => f.id === openId) ?? null}
        person={openId ? person(openId) : null}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}

function AddFriendSheet({ open, onClose, onInvite }: { open: boolean; onClose: () => void; onInvite: () => void }) {
  const add = useAddFriend()
  const { show } = useToast()
  const [email, setEmail] = useState('')
  const [shareMine, setShareMine] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const errors = useFieldErrors<'email'>()

  const close = () => {
    setEmail('')
    setShareMine(true)
    setNotFound(false)
    errors.clear()
    onClose()
  }
  const save = async () => {
    errors.clear()
    setNotFound(false)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return errors.fail('Type their email address.', 'email')
    try {
      await add.mutateAsync({ email: email.trim(), shareMine })
      show(shareMine ? 'Friend added. They can see your entries; you’ve asked to see theirs.' : 'Request sent. You’ll see theirs once they say yes.')
      close()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Couldn’t add them. Try again.'
      if (/no ledgeeaze account/i.test(message)) {
        setNotFound(true)
        errors.fail('No LedgeEaze account with that email.', 'email')
      } else errors.fail(message)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Find a friend" headerActions={<SheetSaveButton onClick={save} busy={add.isPending} label="Add" />}>
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <label className="flex flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">Their email</span>
          <span
            className={clsx(
              'flex h-[52px] items-center gap-2.5 rounded-2xl border bg-app-card px-3.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
              errors.on('email') ? 'border-danger' : 'border-app-border'
            )}
          >
            <Search size={18} className="shrink-0 text-accent-dark" aria-hidden="true" />
            <input
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
              }}
              className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            />
          </span>
          <FieldError message={errors.on('email')} />
        </label>
        {notFound && (
          <button type="button" onClick={onInvite} className="-mt-2 w-fit text-helper font-semibold text-accent-dark hover:underline">
            Not on LedgeEaze yet? Send a welcome link
          </button>
        )}
        <SwitchRow
          label="Share my entries with them"
          hint="They can see your entries (not ones you keep to yourself). You can stop anytime."
          checked={shareMine}
          onChange={setShareMine}
        />
        <p className="text-helper text-slate-500">We’ll also ask to see theirs. They choose whether to say yes.</p>
      </div>
    </Modal>
  )
}

function FriendSheet({ friend, person, onClose }: { friend: Friend | null; person: Person | null; onClose: () => void }) {
  const share = useShareWithFriend()
  const ask = useSendAccessRequest()
  const cancelAsk = useRemoveAccessRow()
  const approve = useApproveAccessRequest()
  const remove = useRemoveFriend()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const birthday = useFriendBirthday(friend?.id ?? null).data ?? null
  if (!friend || !person) return null

  const mineOn = friend.theySeeMine === 'on'
  const theirs = {
    on: 'On. They can stop it anytime.',
    paused: `${person.first} paused it for now.`,
    waiting: `You asked. Waiting for ${person.first} to say yes.`,
    off: '',
  }[friend.iSeeTheirs]

  return (
    <>
      <Modal open={!confirmRemove} onClose={onClose} title={person.name}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <Avatar avatar={person.avatar} name={person.name} size={64} />
            <div className="min-w-0">
              <p className="truncate font-serif text-xl font-semibold text-slate-900">{person.name}</p>
              <p className="truncate text-helper text-slate-500">{person.email}</p>
              <p className="text-helper text-slate-500">
                Friends since {new Date(friend.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {(person.bio || birthday) && (
            <section className="flex flex-col gap-2.5 rounded-2xl bg-slate-50 p-3.5 dark:bg-white/5">
              {person.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{person.bio}</p>}
              {birthday && (
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Cake size={16} className="text-brass" aria-hidden="true" />
                  Birthday · {birthdayLabel(birthday)}
                </p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h3 className="text-helper font-semibold uppercase tracking-wide text-slate-500">Sharing</h3>
            {friend.theySeeMine === 'asking' ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 p-3">
                <span className="text-sm text-slate-700">{person.first} wants to see your entries</span>
                <Button className="shrink-0" disabled={approve.isPending} onClick={() => friend.incomingId && approve.mutate(friend.incomingId)}>
                  Say yes
                </Button>
              </div>
            ) : (
              <SwitchRow
                label={`Let ${person.first} see my entries`}
                hint="Entries you keep to yourself stay hidden."
                checked={mineOn}
                disabled={share.isPending}
                onChange={(on) => share.mutate({ friendId: friend.id, on })}
              />
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-app-border p-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">See {person.first}’s entries</span>
                {theirs && <span className="block text-helper text-slate-500">{theirs}</span>}
              </span>
              {friend.iSeeTheirs === 'off' && (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  disabled={ask.isPending || !person.email}
                  onClick={() => ask.mutate(person.email, { onSuccess: () => show(`Asked ${person.first}.`) })}
                >
                  Ask
                </Button>
              )}
              {friend.iSeeTheirs === 'waiting' && friend.outgoingId && (
                <Button variant="secondary" className="shrink-0" disabled={cancelAsk.isPending} onClick={() => cancelAsk.mutate(friend.outgoingId!)}>
                  <Clock size={14} aria-hidden="true" /> Cancel
                </Button>
              )}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-app-border p-3.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-semibold text-slate-500">
                {friend.net > 0 ? `${person.first} owes you` : friend.net < 0 ? `You owe ${person.first}` : 'Money between you'}
              </span>
              <span className={clsx('font-serif text-xl font-semibold tabular-nums', friend.net > 0 ? 'text-positive' : friend.net < 0 ? 'text-danger' : 'text-slate-500')}>
                {friend.net === 0 ? 'Settled' : format(Math.abs(friend.net))}
              </span>
            </span>
            <Link
              to="/shared"
              onClick={onClose}
              className="press inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-app-border px-3.5 text-sm font-bold text-accent-dark"
            >
              See splits <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <button type="button" onClick={() => setConfirmRemove(true)} className="w-fit text-sm font-semibold text-danger hover:underline">
            Remove friend
          </button>
        </div>
      </Modal>
      <ConfirmDeleteModal
        open={confirmRemove}
        title={`Remove ${person.first}?`}
        pending={remove.isPending}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() =>
          remove.mutate(friend.id, {
            onSuccess: () => {
              setConfirmRemove(false)
              onClose()
              show(`${person.first} removed.`)
            },
          })
        }
      >
        You’ll stop seeing each other’s entries. Splits between you stay.
      </ConfirmDeleteModal>
    </>
  )
}

/** A labelled on/off switch row (same look as Settings' switches). */
function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className={clsx('flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-app-border p-3', disabled && 'opacity-60')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-helper text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
          checked ? 'bg-accent' : 'bg-slate-300'
        )}
      >
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </label>
  )
}

/** The two small chips on a friend's row: what they see of yours, what you see of theirs. */
function friendChips(f: Friend): { label: string; tone: string }[] {
  const grey = 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
  const chips: { label: string; tone: string }[] = []
  if (f.theySeeMine === 'on') chips.push({ label: 'Sees yours', tone: 'bg-accent-light text-accent-on-light' })
  else if (f.theySeeMine === 'asking') chips.push({ label: 'Wants to see yours', tone: 'bg-brass-light text-slate-800' })
  else if (f.theySeeMine === 'paused') chips.push({ label: 'Yours paused', tone: grey })
  else chips.push({ label: 'Doesn’t see yours', tone: grey })
  if (f.iSeeTheirs === 'on') chips.push({ label: 'You see theirs', tone: 'bg-positive-light text-positive' })
  else if (f.iSeeTheirs === 'waiting') chips.push({ label: 'You asked', tone: 'bg-brass-light text-slate-800' })
  else if (f.iSeeTheirs === 'paused') chips.push({ label: 'They paused', tone: grey })
  return chips
}

/** 'MM-DD' -> "Mar 14" (the year is never shared). */
function birthdayLabel(mmdd: string) {
  const [m, d] = mmdd.split('-').map(Number)
  return new Date(2000, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
