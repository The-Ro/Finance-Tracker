import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useProfiles } from '@/hooks/useProfiles'
import {
  useOwnedAccessRows,
  useRequestedAccessRows,
  useApproveAccessRequest,
  useRemoveAccessRow,
  useSendAccessRequest,
} from '@/hooks/useSharing'

const STATUS_DISPLAY_MS = 2000

type RowStatus = 'approved' | 'declined' | 'followed'

interface ActionedRow {
  id: string
  requesterUserId: string
  status: RowStatus
}

export function IncomingAccessRequests() {
  const profiles = useProfiles()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const approve = useApproveAccessRequest()
  const remove = useRemoveAccessRow()
  const sendRequest = useSendAccessRequest()

  // Snapshotted locally so a row keeps showing its result for a beat after
  // acting on it, independent of when the underlying query actually refetches
  // (a decline deletes the row outright, so there'd be nothing left to show).
  const [actioned, setActioned] = useState<Record<string, ActionedRow>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const currentTimers = timers.current
    return () => {
      Object.values(currentTimers).forEach(clearTimeout)
    }
  }, [])

  const profileMap = profiles.data ?? {}
  const nameFor = (id: string) => profileMap[id]?.displayName || profileMap[id]?.email || 'Unknown user'
  const pendingIncoming = (owned.data ?? []).filter((r) => r.status === 'pending')
  const alreadyFollowing = useMemo(
    () => new Set((requested.data ?? []).map((r) => r.owner_user_id)),
    [requested.data]
  )

  const markActioned = (id: string, requesterUserId: string, status: RowStatus) => {
    setActioned((prev) => ({ ...prev, [id]: { id, requesterUserId, status } }))
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => {
      setActioned((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, STATUS_DISPLAY_MS)
  }

  const handleApprove = (id: string, requesterUserId: string) => {
    markActioned(id, requesterUserId, 'approved')
    approve.mutate(id)
  }
  const handleDecline = (id: string, requesterUserId: string) => {
    markActioned(id, requesterUserId, 'declined')
    remove.mutate(id)
  }
  const handleFollowBack = (id: string, requesterUserId: string) => {
    const email = profileMap[requesterUserId]?.email
    if (!email) return
    markActioned(id, requesterUserId, 'followed')
    sendRequest.mutate(email)
  }

  // Pending rows not yet acted on, plus a synthetic entry for each recently-actioned
  // row so it stays visible for STATUS_DISPLAY_MS even after leaving pendingIncoming.
  const visibleRows = [
    ...pendingIncoming.filter((r) => !actioned[r.id]),
    ...Object.values(actioned).map((a) => ({ id: a.id, requester_user_id: a.requesterUserId })),
  ]

  const STATUS_LABEL: Record<RowStatus, string> = {
    approved: 'Approved',
    declined: 'Declined',
    followed: 'Follow request sent',
  }

  // Settings' own Sharing section is where "you have no pending requests"
  // reassurance belongs -- in the notification dropdown specifically, an
  // empty section is just noise once something else in the panel actually
  // needs attention.
  if (visibleRows.length === 0) return null

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Requests to view your transactions</h3>
        <p className="mt-1 text-helper text-slate-500">Your transactions are private until you approve someone here.</p>
      </div>
      <ul className="flex flex-col gap-2">
          {visibleRows.map((r) => {
            const status = actioned[r.id]?.status
            const following = alreadyFollowing.has(r.requester_user_id)
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={profileMap[r.requester_user_id]?.avatar ?? null} name={nameFor(r.requester_user_id)} />
                  <span className="truncate text-sm text-slate-800">{nameFor(r.requester_user_id)}</span>
                </div>
                {status ? (
                  <span className="shrink-0 text-helper font-medium text-slate-500">{STATUS_LABEL[status]}</span>
                ) : (
                  <div className="flex shrink-0 gap-2">
                    {!following && (
                      <Button
                        variant="secondary"
                        onClick={() => handleFollowBack(r.id, r.requester_user_id)}
                        disabled={sendRequest.isPending || !profileMap[r.requester_user_id]?.email}
                      >
                        <UserPlus size={14} /> Follow back
                      </Button>
                    )}
                    <Button onClick={() => handleApprove(r.id, r.requester_user_id)} disabled={approve.isPending}>
                      <Check size={14} /> Approve
                    </Button>
                    <Button variant="secondary" onClick={() => handleDecline(r.id, r.requester_user_id)} disabled={remove.isPending}>
                      <X size={14} /> Decline
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
      </ul>
    </Card>
  )
}
