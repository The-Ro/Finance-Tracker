import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useProfiles } from '@/hooks/useProfiles'
import { useOwnedAccessRows, useApproveAccessRequest, useRemoveAccessRow } from '@/hooks/useSharing'

export function IncomingAccessRequests() {
  const profiles = useProfiles()
  const owned = useOwnedAccessRows()
  const approve = useApproveAccessRequest()
  const remove = useRemoveAccessRow()

  const profileMap = profiles.data ?? {}
  const nameFor = (id: string) => profileMap[id]?.displayName || profileMap[id]?.email || 'Unknown user'
  const pendingIncoming = (owned.data ?? []).filter((r) => r.status === 'pending')

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Requests to view your transactions</h3>
        <p className="mt-1 text-helper text-slate-500">Your transactions are private until you approve someone here.</p>
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
  )
}
