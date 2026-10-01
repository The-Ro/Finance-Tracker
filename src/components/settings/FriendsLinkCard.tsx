import { Link } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'

/** Settings -> Friends: sharing now lives on its own page. */
export function FriendsLinkCard() {
  return (
    <Card className="p-2">
      <Link to="/friends" className="flex min-h-[64px] items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-on-light">
          <Users size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Friends</span>
          <span className="block text-helper text-slate-500">Add friends, choose what each of you sees, and see who owes what.</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
    </Card>
  )
}
