import { Link } from 'react-router-dom'
import { PiggyBank } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useBudgetAlerts } from '@/hooks/useBudgets'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

export function BudgetAlerts() {
  const alerts = useBudgetAlerts()
  const { format } = useFormatCurrency()

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Budget alerts</h3>
        <p className="mt-1 text-helper text-slate-500">Categories close to or over their limit this month.</p>
      </div>
      {alerts.length === 0 ? (
        <p className="text-helper text-slate-400">Nothing close to a limit right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.budget.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                  <PiggyBank size={14} className={a.status === 'over' ? 'text-red-500' : 'text-caution'} />
                  {a.budget.category}
                </span>
                <span className="shrink-0 text-helper text-slate-500">
                  {format(a.spent)} / {format(a.budget.monthly_limit)}
                </span>
              </div>
              <ProgressBar percent={a.percent} tone={a.status === 'over' ? 'danger' : 'caution'} />
            </li>
          ))}
        </ul>
      )}
      <Link to="/budgets" className="text-helper font-medium text-accent hover:underline">
        View budgets
      </Link>
    </Card>
  )
}
