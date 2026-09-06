import { useState } from 'react'
import { Check, Send, UserMinus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useProfiles } from '@/hooks/useProfiles'
import {
  useOwnedAccessRows,
  useRequestedAccessRows,
  useSendAccessRequest,
  useApproveAccessRequest,
  useRemoveAccessRow,
} from '@/hooks/useSharing'

const PLACEHOLDER = 'Choose a person'

export function SharingSettings() {
  const { userId } = useAuth()
  const profiles = useProfiles()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const sendRequest = useSendAccessRequest()
  const approve = useApproveAccessRequest()
  const remove = useRemoveAccessRow()

  const [selectedLabel, setSelectedLabel] = useState(PLACEHOLDER)
  const [error, setError] = useState<string | null>(null)

  const profileMap = profiles.data ?? {}
  const nameFor = (id: string) => profileMap[id]?.displayName || profileMap[id]?.email || 'Unknown user'

  const pendingIncoming = (owned.data ?? []).filter((r) => r.status === 'pending')
  const approvedViewers = (owned.data ?? []).filter((r) => r.status === 'approved')
  const outgoing = requested.data ?? []
  const requestedIds = new Set(outgoing.map((r) => r.owner_user_id))

  const requestableEntries = Object.entries(profileMap)
    .filter(([id]) => id !== userId && !requestedIds.has(id))
    .map(([id, p]) => ({ id, label: p.displayName || p.email }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const labelToId = new Map(requestableEntries.map((e) => [e.label, e.id]))

  const handleSend = async () => {
    setError(null)
    const targetId = labelToId.get(selectedLabel)
    if (!targetId) return setError('Choose a person to send a request to.')
    try {
      await sendRequest.mutateAsync(targetId)
      setSelectedLabel(PLACEHOLDER)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Requests to view your transactions</h3>
          <p className="mt-1 text-helper text-slate-500">
            Your transactions are private until you approve someone here.
          </p>
        </div>
        {pendingIncoming.length === 0 ? (
          <p className="text-helper text-slate-400">No pending requests.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingIncoming.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={profileMap[r.requester_user_id]?.avatar ?? null} name={nameFor(r.requester_user_id)} />
                  <span className="truncate text-sm text-slate-800">{nameFor(r.requester_user_id)}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
                    <X size={14} /> Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">People who can see your transactions</h3>
          <p className="mt-1 text-helper text-slate-500">Remove someone any time to revoke their access.</p>
        </div>
        {approvedViewers.length === 0 ? (
          <p className="text-helper text-slate-400">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {approvedViewers.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={profileMap[r.requester_user_id]?.avatar ?? null} name={nameFor(r.requester_user_id)} />
                  <span className="truncate text-sm text-slate-800">{nameFor(r.requester_user_id)}</span>
                </div>
                <button
                  aria-label={`Remove ${nameFor(r.requester_user_id)}`}
                  onClick={() => remove.mutate(r.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <UserMinus size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Request to view someone's transactions</h3>
          <p className="mt-1 text-helper text-slate-500">They'll need to approve it before you can see anything.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Dropdown
              options={[PLACEHOLDER, ...requestableEntries.map((e) => e.label)]}
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
            />
          </div>
          <Button onClick={handleSend} disabled={sendRequest.isPending}>
            <Send size={14} /> {sendRequest.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </div>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}

        {outgoing.length > 0 && (
          <ul className="mt-1 flex flex-col gap-2 border-t border-app-border pt-3">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-slate-700">{nameFor(r.owner_user_id)}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={'text-helper ' + (r.status === 'approved' ? 'text-positive' : 'text-slate-400')}>
                    {r.status === 'approved' ? 'Approved' : 'Pending'}
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
