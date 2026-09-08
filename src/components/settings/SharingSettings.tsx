import { useMemo, useState } from 'react'
import { Eye, EyeOff, Search, Send, UserMinus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useProfiles } from '@/hooks/useProfiles'
import {
  useOwnedAccessRows,
  useRequestedAccessRows,
  useSendAccessRequest,
  useRemoveAccessRow,
  useToggleAccessPause,
} from '@/hooks/useSharing'

export function SharingSettings() {
  const { userId } = useAuth()
  const profiles = useProfiles()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const sendRequest = useSendAccessRequest()
  const remove = useRemoveAccessRow()
  const togglePause = useToggleAccessPause()

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const profileMap = profiles.data ?? {}
  const nameFor = (id: string) => profileMap[id]?.displayName || profileMap[id]?.email || 'Unknown user'

  // Paused grants stay in this list (not just approved) -- pausing is meant
  // to be a quick, reversible toggle, not something that drops someone off
  // the list and makes them dig through "requested" history to find them
  // again.
  const approvedViewers = (owned.data ?? []).filter((r) => r.status === 'approved' || r.status === 'paused')
  const outgoing = requested.data ?? []
  const requestedIds = new Set(outgoing.map((r) => r.owner_user_id))

  const requestableEntries = Object.entries(profileMap)
    .filter(([id]) => id !== userId && !requestedIds.has(id))
    .map(([id, p]) => ({ id, label: p.displayName || p.email, email: p.email, avatar: p.avatar }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || selectedId) return []
    return requestableEntries
      .filter((e) => e.label.toLowerCase().includes(trimmed) || e.email.toLowerCase().includes(trimmed))
      .slice(0, 8)
  }, [query, selectedId, requestableEntries])

  const selected = selectedId ? requestableEntries.find((e) => e.id === selectedId) : undefined

  const handleSend = async () => {
    setError(null)
    if (!selectedId) return setError('Search for a person by name or email, then select them.')
    try {
      await sendRequest.mutateAsync(selectedId)
      setSelectedId(null)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">People who can see your transactions</h3>
          <p className="mt-1 text-helper text-slate-500">
            Toggle the eye to pause someone's access without removing them, or remove to revoke it outright.
          </p>
        </div>
        {approvedViewers.length === 0 ? (
          <p className="text-helper text-slate-400">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {approvedViewers.map((r) => {
              const paused = r.status === 'paused'
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
            Search by name or email. They'll need to approve it before you can see anything.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="relative flex-1">
            {selected ? (
              <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-accent bg-accent-light px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={selected.avatar} name={selected.label} size={22} />
                  <span className="truncate text-sm font-medium text-accent-dark">{selected.label}</span>
                </div>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => {
                    setSelectedId(null)
                    setQuery('')
                  }}
                  className="shrink-0 rounded-full p-1 text-accent-dark hover:bg-accent/20"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="min-h-[44px] w-full rounded-lg border border-app-border bg-white pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
            {matches.length > 0 && (
              <ul className="animate-scale-in absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-app-border bg-white py-1 shadow-card">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(m.id)
                        setQuery(m.label)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-light hover:text-accent-dark"
                    >
                      <Avatar avatar={m.avatar} name={m.label} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-800">{m.label}</span>
                        {m.email !== m.label && <span className="block truncate text-helper text-slate-400">{m.email}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && !selected && matches.length === 0 && (
              <p className="mt-1 text-helper text-slate-400">No matching users.</p>
            )}
          </div>
          <Button onClick={handleSend} disabled={sendRequest.isPending || !selectedId}>
            <Send size={14} /> {sendRequest.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </div>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}

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
