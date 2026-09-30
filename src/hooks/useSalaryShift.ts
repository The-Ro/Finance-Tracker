import { useMemo } from 'react'
import { useUserSettings } from '@/hooks/useUserSettings'
import { shiftLateSalary } from '@/lib/salaryMonth'

/**
 * Transactions for monthly summaries: with "Count my salary toward the next
 * month" on, a late-month salary moves to the 1st of the next month (a copy);
 * otherwise the rows come back as they are. Only for totals by month --
 * never for lists, balances or exports.
 */
export function useSalaryShift<T extends { type: string; date: string; category: string | null; tags: string[] }>(rows: T[] | undefined): T[] {
  const { data } = useUserSettings()
  const on = data?.salaryNextMonth ?? false
  return useMemo(() => (rows ? (on ? shiftLateSalary(rows) : rows) : []), [rows, on])
}
