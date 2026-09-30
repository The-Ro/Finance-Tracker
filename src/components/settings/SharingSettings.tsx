import clsx from 'clsx'
import { FieldError, FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useState } from 'react'
import { Clock, Eye, EyeOff, Search, Send, UserCheck, UserMinus, UserPlus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useProfiles } from '@/hooks/useProfiles'
import {
  useOwnedAccessRows,
  useRequestedAccessRows,
  useSendAccessRequest,
  useFindProfileByEmail,
  useRemoveAccessRow,
  useToggleAccessPause,
  type FoundProfile,
} from '@/hooks/useSharing'

export function SharingSettings() {
  const profiles = useProfiles()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const sendRequest = useSendAccessRequest()
  const remove = useRemoveAccessRow()
  const togglePause = useToggleAccessPause()

  const findProfile = useFindProfileByEmail()

  const [email, setEmail] = useState('')
  const [found, setFound] = useState<FoundProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const errors = useFieldErrors<'email'>()

  const profileMap = profiles.data ?? {}
  const nameFor = (id: string) => profileMap[id]?.displayName || profileMap[id]?.email || 'Unknown user'

  // Paused grants stay in this list (not just approved) -- pausing is meant
  // to be a quick, reversible toggle, not something that drops someone off
  // the list and makes them dig through "requested" history to find them
  // again.
  const approvedViewers = (owned.data ?? []).filter((r) => r.status === 'approved' || r.status === 'paused')
  const outgoing = requested.data ?? []
  const requestedIds = new Set(outgoing.map((r) => r.owner_user_id))

  const clearFound = () => {
    setFound(null)
    setNotFound(false)
    setEmail('')
  }

  // Profiles aren't a readable directory anymore, so a new person can only be
  // found by typing their exact email (find_profile_by_email RPC).
  const handleFind = async () => {
    errors.clear()
    setNotFound(false)
    const trimmed = email.trim()
    if (!trimmed) return
    try {
      const result = await findProfile.mutateAsync(trimmed)
      if (!result) return setNotFound(true)
      if (requestedIds.has(result.id)) {
        return errors.fail("You've already asked to see this person's entries (or you can already).", 'email')
      }
      setFound(result)
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not look that person up.', 'email')
    }
  }

  const handleSend = async () => {
    errors.clear()
    if (!found) return errors.fail("Enter the person's email address and find them first.", 'email')
    try {
      await sendRequest.mutateAsync(found.email)
      clearFound()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not send the request.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">People who can see your transactions</h3>
          <p className="mt-1 text-helper text-slate-500">
            Tap the person-plus to ask to see theirs too, the eye to pause someone for now, or Remove to stop
            sharing with them.
          </p>
        </div>
        {approvedViewers.length === 0 ? (
          <p className="text-helper text-slate-400">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {approvedViewers.map((r) => {
              const paused = r.status === 'paused'
              // Follow back: do you see *their* transactions too?
              const theirs = outgoing.find((o) => o.owner_user_id === r.requester_user_id)
              const theirEmail = profileMap[r.requester_user_id]?.email
              const name = nameFor(r.requester_user_id)
              return (
                <li
                  key={r.id}
                  className={
                    'flex items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2' +
                    (paused ? ' opacity-60' : '')
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar avatar={profileMap[r.requester_user_id]?.avatar ?? null} name={nameFor(r.requester_user_id)} />
                    <span className="truncate text-sm text-slate-800">{nameFor(r.requester_user_id)}</span>
                    {paused && <span className="shrink-0 text-helper text-slate-400">Paused</span>}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {theirs ? (
                      <span
                        role="img"
                        aria-label={theirs.status === 'pending' ? `Waiting for ${name} to say yes` : `You can see ${name}'s transactions`}
                        title={theirs.status === 'pending' ? 'Asked to see theirs -- waiting for a yes' : 'You can see theirs too'}
                        className={
                          'flex h-9 w-9 items-center justify-center rounded-full ' +
                          (theirs.status === 'pending' ? 'text-slate-400' : 'text-positive')
                        }
                      >
                        {theirs.status === 'pending' ? <Clock size={16} /> : <UserCheck size={16} />}
                      </span>
                    ) : theirEmail ? (
                      <button
                        aria-label={`Ask to see ${name}'s transactions too`}
                        title="Ask to see theirs too"
                        onClick={() => sendRequest.mutate(theirEmail)}
                        disabled={sendRequest.isPending}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-accent-dark hover:bg-accent-light disabled:opacity-50"
                      >
                        <UserPlus size={16} />
                      </button>
                    ) : null}
                    <button
                      aria-label={paused ? `Resume ${nameFor(r.requester_user_id)}'s access` : `Pause ${nameFor(r.requester_user_id)}'s access`}
                      aria-pressed={!paused}
                      onClick={() => togglePause.mutate({ id: r.id, paused: !paused })}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {paused ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      aria-label={`Remove ${nameFor(r.requester_user_id)}`}
                      onClick={() => remove.mutate(r.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Request to view someone's transactions</h3>
          <p className="mt-1 text-helper text-slate-500">
            Enter their email address. They'll need to approve it before you can see anything.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            {found ? (
              <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-accent bg-accent-light px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={found.avatar} name={found.label} size={22} />
                  <span className="truncate text-sm font-medium text-accent-on-light">{found.label}</span>
                </div>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={clearFound}
                  className="shrink-0 rounded-full p-1 text-accent-on-light hover:bg-accent/20"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  aria-invalid={errors.on('email') ? true : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setNotFound(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleFind()
                    }
                  }}
                  placeholder="their.email@example.com"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={clsx(
                    'min-h-[44px] w-full rounded-lg border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-1',
                    errors.on('email') ? 'border-danger ring-1 ring-danger' : 'border-app-border focus:border-accent focus:ring-accent'
                  )}
                />
              </div>
            )}
            <FieldError message={errors.on('email')} />
            {notFound && !found && (
              <p className="mt-1 text-helper text-slate-400">
                No LedgeEaze account with that exact email. Check the spelling, or ask them to sign up first.
              </p>
            )}
          </div>
          {found ? (
            <Button onClick={handleSend} disabled={sendRequest.isPending}>
              <Send size={14} /> {sendRequest.isPending ? 'Sending…' : 'Send request'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleFind} disabled={findProfile.isPending || !email.trim()}>
              <Search size={14} /> {findProfile.isPending ? 'Finding…' : 'Find'}
            </Button>
          )}
        </div>
        <FormError message={errors.general} />

        {outgoing.length > 0 && (
          <ul className="mt-1 flex flex-col gap-2 border-t border-app-border pt-3">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={profileMap[r.owner_user_id]?.avatar ?? null} name={nameFor(r.owner_user_id)} size={24} />
                  <span className="truncate text-sm text-slate-700">{nameFor(r.owner_user_id)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={'text-helper ' + (r.status === 'approved' ? 'text-positive' : 'text-slate-400')}>
                    {r.status === 'approved' ? 'Approved' : r.status === 'paused' ? 'Paused by them' : 'Pending'}
                  </span>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => remove.mutate(r.id)}
                      className="text-helper font-medium text-slate-500 hover:text-red-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
