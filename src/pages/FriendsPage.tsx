import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Cake, ChevronRight, Clock, Send, UserPlus, Users } from 'lucide-react'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { FormError } from '@/components/ui/FieldError'
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
  const loading = owned.isLoading || requested.isLoading
  const invite = async () => {
    const result = await shareText(
      'Join me on LedgeEaze',
      `I use LedgeEaze to track money. Join me so we can share expenses and split costs: ${window.location.origin}`
    )
    if (result === 'copied') show('Invite link copied. Paste it in a message.')
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Friends" actions={<PageHeaderAction label="Add friend" onClick={() => setAdding(true)} />} />
      <p className="-mt-2 text-sm text-slate-500">People you share with. You choose what each side sees.</p>

      {/* Requests to see your entries come first. */}
      {asking.length > 0 && (
        <Card className="flex flex-col gap-3 border-accent/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Want to see your entries</h2>
          <ul className="stagger-rows flex flex-col gap-3">
            {asking.map((f) => {
              const p = person(f.id)
              return (
                <li key={f.id} className="flex items-center gap-3">
                  <Avatar avatar={p.avatar} name={p.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="block truncate text-helper text-slate-500">{p.email}</span>
                  </span>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    disabled={removeRow.isPending}
                    onClick={() => f.incomingId && removeRow.mutate(f.incomingId)}
                  >
                    No
                  </Button>
                  <Button className="shrink-0" disabled={approve.isPending} onClick={() => f.incomingId && approve.mutate(f.incomingId)}>
                    Yes
                  </Button>
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
                <UserPlus size={16} aria-hidden="true" /> Add friend
              </Button>
              <Button variant="secondary" onClick={() => void invite()}>
                <Send size={15} aria-hidden="true" /> Invite
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="p-2">
          <ul className="stagger-rows flex flex-col divide-y divide-app-border">
            {friends.map((f) => {
              const p = person(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(f.id)}
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Avatar avatar={p.avatar} name={p.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                      <span className="block truncate text-helper text-slate-500">{sharingWords(f)}</span>
                    </span>
                    {f.net !== 0 && (
                      <span className={clsx('shrink-0 text-right text-helper font-semibold tabular-nums', f.net > 0 ? 'text-positive' : 'text-danger')}>
                        {f.net > 0 ? 'owes you' : 'you owe'}
                        <span className="block font-serif text-sm">{format(Math.abs(f.net))}</span>
                      </span>
                    )}
                    <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {friends.length > 0 && (
        <button
          type="button"
          onClick={() => void invite()}
          className="press flex items-center gap-3 rounded-card border border-dashed border-app-border px-4 py-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-on-light">
            <Send size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">Invite someone</span>
            <span className="block text-helper text-slate-500">Not on LedgeEaze yet? Send them a link.</span>
          </span>
        </button>
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
    <Modal open={open} onClose={close} title="Add a friend" headerActions={<SheetSaveButton onClick={save} busy={add.isPending} label="Add" />}>
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <TextField
          label="Their email"
          type="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="name@example.com"
          error={errors.on('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {notFound && (
          <button type="button" onClick={onInvite} className="-mt-2 w-fit text-helper font-semibold text-accent-dark hover:underline">
            Invite them to LedgeEaze instead
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
          <div className="flex items-center gap-3">
            <Avatar avatar={person.avatar} name={person.name} size={52} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{person.name}</p>
              <p className="truncate text-helper text-slate-500">{person.email}</p>
              <p className="text-helper text-slate-500">
                Friends since {new Date(friend.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {(person.bio || birthday) && (
            <section className="flex flex-col gap-2">
              <h3 className="text-helper font-semibold uppercase tracking-wide text-slate-500">About</h3>
              {person.bio && <p className="whitespace-pre-line text-sm text-slate-700">{person.bio}</p>}
              {birthday && (
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <Cake size={16} className="text-brass" aria-hidden="true" />
                  Birthday {birthdayLabel(birthday)}
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

          <section className="flex flex-col gap-2">
            <h3 className="text-helper font-semibold uppercase tracking-wide text-slate-500">Money</h3>
            <Link to="/shared" onClick={onClose} className="flex items-center justify-between gap-3 rounded-xl border border-app-border p-3 hover:bg-slate-50">
              <span className="text-sm text-slate-700">
                {friend.net > 0 ? (
                  <>
                    {person.first} owes you <strong className="text-positive">{format(friend.net)}</strong>
                  </>
                ) : friend.net < 0 ? (
                  <>
                    You owe {person.first} <strong className="text-danger">{format(-friend.net)}</strong>
                  </>
                ) : (
                  'All settled'
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-helper font-semibold text-accent-dark">
                Splits <ChevronRight size={14} aria-hidden="true" />
              </span>
            </Link>
          </section>

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

/** 'MM-DD' -> "Mar 14" (the year is never shared). */
function birthdayLabel(mmdd: string) {
  const [m, d] = mmdd.split('-').map(Number)
  return new Date(2000, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
