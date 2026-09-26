import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { RecurringItem } from '@/hooks/useRecurring'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatShortDate, todayISO } from '@/lib/format'

interface ComingUpCardProps {
  items: RecurringItem[]
}

export function ComingUpCard({ items }: ComingUpCardProps) {
  const { format } = useFormatCurrency()
  const upcoming = [...items]
    .filter((i) => i.active)
    .sort((a, b) => (a.next_date < b.next_date ? -1 : 1))
    .slice(0, 5)

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Coming up</h3>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing confirmed yet"
          description="Recurring payments and subscriptions you confirm will show up here."
          action={
            <Link to="/recurring" className="text-helper font-medium text-accent-dark hover:underline">
              Go to Recurring
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((item) => {
            const isOverdue = item.next_date < todayISO()
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.name}</p>
                  <p className={isOverdue ? 'text-helper font-medium text-caution' : 'text-helper text-slate-500'}>
                    {isOverdue ? `Overdue since ${formatShortDate(item.next_date)}` : formatShortDate(item.next_date)}
                  </p>
                </div>
                <span className="font-semibold text-slate-900">{format(item.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
