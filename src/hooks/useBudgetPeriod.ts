import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions } from '@/hooks/useTransactions'
import { budgetPeriod, type BudgetPeriod } from '@/lib/budgetPeriod'
import { isSalaryEntry } from '@/lib/salaryMonth'
import { formatShortDate, todayISO } from '@/lib/format'

/**
 * The period budgets count spending over: the calendar month, or -- with
 * "Start budgets on pay day" on -- from the day the salary arrived. `label`
 * says it in words ("this month" / "since Sep 30"), `previousLabel` the one before.
 */
export function useBudgetPeriod(): BudgetPeriod & { label: string; previousLabel: string } {
  const { userId } = useAuth()
  const { data: settings } = useUserSettings()
  const { data: transactions } = useMyTransactions(userId)
  const fromPayday = settings?.budgetFromPayday ?? false
  const salaryDay = settings?.salary?.day ?? null
  return useMemo(() => {
    const salaryDates = fromPayday ? (transactions ?? []).filter(isSalaryEntry).map((t) => t.date) : []
    const p = budgetPeriod({ fromPayday, salaryDay, salaryDates, today: todayISO() })
    return {
      ...p,
      label: p.fromPayday && p.current.start ? `since ${formatShortDate(p.current.start)}` : 'this month',
      previousLabel: p.fromPayday ? 'Last pay period' : 'Last month',
    }
  }, [fromPayday, salaryDay, transactions])
}
