import { useMutation } from '@tanstack/react-query'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useAddTransaction } from '@/hooks/useTransactions'
import { useCategories, useTags } from '@/hooks/useLookupLists'
import { SALARY_TAG } from '@/lib/salary'
import { todayISO } from '@/lib/format'

/**
 * "Yes, my salary arrived": logs it as income (category Salary, tag #salary)
 * into the salary account and marks the month answered. Shared by Home's
 * SalaryPrompt and the ✓ on the bell's pay-day note, so both do exactly the
 * same thing.
 */
export function useSalaryConfirm() {
  const settings = useUserSettings()
  const addTransaction = useAddTransaction()
  const { income: incomeCategories } = useCategories()
  const { data: tags = [], add: addTag } = useTags()

  return useMutation({
    mutationFn: async (input: { amount: number; month: string }) => {
      const salary = settings.data?.salary
      if (!salary) throw new Error('Set up your salary in Settings first.')
      if (!tags.includes(SALARY_TAG)) await addTag.mutateAsync(SALARY_TAG)
      await addTransaction.mutateAsync({
        date: todayISO(),
        merchant: 'Salary',
        category: incomeCategories.includes('Salary') ? 'Salary' : (incomeCategories[0] ?? null),
        amount: input.amount,
        type: 'income',
        account: salary.account,
        tags: [SALARY_TAG],
        receipt: false,
        allowDuplicate: true,
      })
      await settings.markSalaryAnswered.mutateAsync(input.month)
      return { amount: input.amount, account: salary.account }
    },
  })
}
